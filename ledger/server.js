require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// custom error class so we can throw stuff with a specific http status code attached
// and catch it separately from actual unexpected server errors down in the route handlers.
// `details` gets merged into the json response
class TradeError extends Error {
    constructor(message, statusCode = 400, details = {}) {
        super(message);
        this.name = 'TradeError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

// sends a TradeError as its own status and message, anything else as a generic 500
function sendError(res, error, context) {
    if (error instanceof TradeError) {
        return res.status(error.statusCode).json({ error: error.message, ...error.details });
    }
    console.error(`[Ledger Error] ${context}: ${error.message}`);
    res.status(500).json({ error: "The ledger hit an internal error. Try again in a moment." });
}

// postgres aborts one transaction to break a deadlock (sqlstate 40P01) or when a
// serializable conflict can't be resolved (40001). the losing transaction gets rolled
// back cleanly, so we run it again on a fresh connection instead of returning a 500
const RETRYABLE_SQLSTATES = new Set(['40P01', '40001']);

// runs `executor` inside begin/commit on its own client and always releases it. on a
// retryable abort it rolls back and tries again (a few times, no backoff, since trades
// are quick), so callers only ever see a real result or a real error. the trade routes
// lock users before portfolios so concurrent trades can't deadlock
async function runInTransaction(executor, attempts = 3) {
    for (let attempt = 1; ; attempt++) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await executor(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            // rollback can fail too if the connection is already broken. that gets
            // swallowed so the original error is the one that surfaces
            try { await client.query('ROLLBACK'); } catch { /* connection's gone */ }
            if (RETRYABLE_SQLSTATES.has(error.code) && attempt < attempts) {
                console.warn(`[Ledger] retrying trade after ${error.code} (attempt ${attempt})`);
                continue;
            }
            throw error;
        } finally {
            client.release();
        }
    }
}

// tickers are always "owner/repo" like "vercel/next.js". this makes sure whatever gets typed
// in doesn't have weird characters in it before it touches the db, and that neither half is
// "." or "..", which would turn into a different github api path
const TICKER_REGEX = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
function isValidTicker(ticker) {
    if (typeof ticker !== 'string' || ticker.length > 140 || !TICKER_REGEX.test(ticker)) return false;
    return ticker.split('/').every((part) => part !== '.' && part !== '..');
}

const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// the pricing formula is in ./pricing.js. the ledger only prices a repo itself when someone
// adds one to their own listings, and it uses the same inputs the worker does
const { computePrice, PRICING_VERSION } = require('./pricing');
// older prices scaled to the current formula by data-engine/backfill.py
const ADJUSTED_VERSION = `${PRICING_VERSION}-adjusted`;
const calls = require('./calls');

const MAX_USER_LISTINGS = 20;

const app = express();
app.disable('x-powered-by');
// we're behind render's proxy, so trust the x-forwarded-for header for req.ip
app.set('trust proxy', 1);

// the visitor's ip for rate limiting. render sits behind cloudflare, which puts the real
// client address in cf-connecting-ip and overwrites whatever a client sends in that header.
// locally there's no cloudflare, so it falls back to req.ip
function clientKey(req) {
    return ipKeyGenerator(req.get('cf-connecting-ip') || req.ip || '');
}

// signed-in routes are limited per user instead of per ip, so people sharing a network
// don't eat each other's allowance
function userKey(req) {
    return req.user ? `user:${req.user.id}` : clientKey(req);
}

function limiter(limit, message, keyGenerator = clientKey) {
    return rateLimit({
        windowMs: 60 * 1000,
        limit,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
    });
}

// CLIENT_ORIGIN is a comma separated list of urls that are allowed to actually call this
// api. if it's not set we just default to localhost so local dev still works
const allowedOrigins = process.env.CLIENT_ORIGIN
? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, ''))
  : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // no origin header = probably a server-to-server request or curl, let it through

        if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
            callback(null, true);
        } else {
            console.warn(`CORS rejected origin: ${origin}`);
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10kb' }));

// log posts with no origin header, could be someone poking around
app.use((req, res, next) => {
    if (req.method === 'POST' && !req.headers.origin) {
        console.warn(`[Security] POST request without Origin header to ${req.path} from IP ${req.ip}`);
    }
    next();
});

// health check for render and the keepalive workflow
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'trx-ledger' });
});

// runs before auth, so a flood of bad tokens can't hammer supabase's auth api
const authGate = limiter(300, "Too many requests. Wait a minute and try again.");
// writes that lock rows get a much stricter limit than reads
const tradeLimiter = limiter(30, "Too many orders in a minute. Wait a moment and try again.", userKey);
const readLimiter = limiter(240, "Too many requests. Wait a moment and try again.", userKey);
const publicLimiter = limiter(120, "Too many requests. Wait a moment and try again.");
const settleLimiter = limiter(10, "Too many settlement requests.");

// the connection pool for postgres. ssl gets turned on for supabase connections since
// they require it, rejectUnauthorized false because supabase's cert chain doesn't always
// play nice with node's default ca bundle. the timeouts make a busy pool or a slow query
// fail in seconds instead of hanging the request
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
});

// this is a separate supabase client just for verifying jwts server-side, it doesn't touch
// the database directly at all, that's what the pg pool above is for
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// middleware that checks the authorization header, validates the jwt against supabase,
// and sticks the user object onto req so the route handlers can use it. anything that
// touches money or a user's portfolio runs through this first
const verifyAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "You're signed out. Sign in again to continue." });
    }

    const token = authHeader.split(' ')[1];
    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
            console.warn(`[Auth] Token validation failed: ${error ? error.message : "No user found"}`);
            return res.status(401).json({ error: "Your session expired. Sign in again to continue." });
        }
        req.user = data.user;
        next();
    } catch (error) {
        console.error(`[Auth] Supabase unreachable: ${error.message}`);
        res.status(503).json({ error: "Sign-in check failed. Try again in a moment." });
    }
};

// finds a listing however the ticker was typed. returns the row or null
async function findRepo(db, ticker, columns = 'ticker') {
    const res = await db.query(`SELECT ${columns} FROM repositories WHERE lower(ticker) = lower($1)`, [ticker]);
    return res.rows[0] || null;
}

// checks the body of a buy or sell before anything touches the db
function readOrder(body) {
    const { ticker, shares, expectedPrice } = body || {};
    if (typeof expectedPrice !== 'number' || !Number.isFinite(expectedPrice) || expectedPrice <= 0) {
        throw new TradeError("Invalid expected price.");
    }
    if (typeof shares !== 'number' || !Number.isInteger(shares) || shares <= 0 || shares > 1000000) {
        throw new TradeError("Invalid share quantity.");
    }
    if (!isValidTicker(ticker)) {
        throw new TradeError("Invalid ticker format. Expected 'owner/repo'.");
    }
    return { ticker, shares, expectedPrice };
}

// reject if the price moved more than 1% since the user opened the ticket. this is the
// slippage check, so nobody can quote an old price and get a better deal than what's live
// right now. the new price goes back with the error so the ticket can update
function checkSlippage(price, expectedPrice) {
    if (Math.abs(price - expectedPrice) / expectedPrice > 0.01) {
        throw new TradeError(`Price moved to ${money(price)} since you opened the ticket.`, 409, { price });
    }
}

// buys a stock. this is the big one, has to check the price hasn't moved too much,
// lock the user's row so two trades can't race each other, and update three tables
// in one transaction
app.post('/api/buy', authGate, verifyAuth, tradeLimiter, async (req, res) => {
    const userId = req.user.id;

    try {
        const { ticker, shares, expectedPrice } = readOrder(req.body);

        // the whole trade runs in one transaction, and retries itself if postgres aborts
        // it for a deadlock
        const fill = await runInTransaction(async (client) => {
            const stock = await findRepo(client, ticker, 'ticker, current_price, source, is_active');
            if (!stock || stock.is_active !== true) throw new TradeError("Not listed.", 404);
            const price = Number(stock.current_price);
            checkSlippage(price, expectedPrice);

            const totalCost = Number((price * shares).toFixed(2));
            // this ticker comes from the db so we know it's the right casing
            const trueTicker = stock.ticker;

            // lock the row so nobody else can mess with the balance mid-trade. without this
            // two buy requests firing at the same time could both read the same balance and
            // both succeed even if the user can only actually afford one of them. users get
            // locked before portfolios here and in the sell route, so a buy and a sell
            // racing on the same holding can't deadlock
            const userRes = await client.query('SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows.length === 0) throw new TradeError("Account not found.", 404);
            const cash = Number(userRes.rows[0].cash_balance);

            // check the user can actually afford this
            if (cash < totalCost) throw new TradeError("Insufficient purchasing power.");

            await client.query('UPDATE users SET cash_balance = cash_balance - $1 WHERE id = $2', [totalCost, userId]);

            // upsert. if they already own this stock, add to it and recalc the avg price as
            // a weighted average: (old shares * old avg price + new shares * new price) /
            // total shares, which gives the new blended cost basis
            const portfolioQuery = `
                INSERT INTO portfolios (user_id, ticker, shares, average_price)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, ticker)
                DO UPDATE SET
                    shares = portfolios.shares + $3,
                    average_price = CAST(((portfolios.shares * portfolios.average_price) + ($3 * $4)) / (portfolios.shares + $3) AS NUMERIC(15,2));
            `;
            await client.query(portfolioQuery, [userId, trueTicker, shares, price]);

            // append-only log of every trade ever made, mostly just for a paper trail
            await client.query(
                'INSERT INTO transactions (user_id, ticker, action, shares, execution_price) VALUES ($1, $2, $3, $4, $5)',
                [userId, trueTicker, 'BUY', shares, price]
            );

            // buying a repo someone added puts it on your own listings too
            if (stock.source === 'user') {
                await client.query(
                    'INSERT INTO user_listings (user_id, ticker) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [userId, trueTicker]
                );
            }

            return { ticker: trueTicker, price, total: totalCost };
        });

        res.json({ success: true, action: 'BUY', shares, ...fill });
    } catch (error) {
        sendError(res, error, 'Buy transaction failed');
    }
});

// same as buy but in reverse. checks they own enough shares instead of checking they
// have enough cash. a listing that went inactive can still be sold at its last price
app.post('/api/sell', authGate, verifyAuth, tradeLimiter, async (req, res) => {
    const userId = req.user.id;

    try {
        const { ticker, shares, expectedPrice } = readOrder(req.body);

        const fill = await runInTransaction(async (client) => {
            const stock = await findRepo(client, ticker, 'ticker, current_price');
            if (!stock) throw new TradeError("Not listed.", 404);
            const price = Number(stock.current_price);
            checkSlippage(price, expectedPrice);

            // this ticker comes from the db so we know it's the right casing
            const trueTicker = stock.ticker;
            const totalValue = Number((price * shares).toFixed(2));

            // lock users before portfolios, same as the buy route, so a buy and a sell on
            // the same holding can't grab the two rows in opposite orders and deadlock. the
            // balance isn't read here, the lock just keeps the ordering
            const userRes = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows.length === 0) throw new TradeError("Account not found.", 404);

            // then the portfolio row: check they actually own enough shares to sell. same
            // race protection as the buy route, just on shares instead of cash
            const portRes = await client.query('SELECT shares FROM portfolios WHERE user_id = $1 AND ticker = $2 FOR UPDATE', [userId, trueTicker]);
            if (portRes.rows.length === 0 || portRes.rows[0].shares < shares) {
                throw new TradeError("You don't hold that many shares.");
            }

            await client.query('UPDATE users SET cash_balance = cash_balance + $1 WHERE id = $2', [totalValue, userId]);

            await client.query('UPDATE portfolios SET shares = shares - $1 WHERE user_id = $2 AND ticker = $3', [shares, userId, trueTicker]);

            await client.query(
                'INSERT INTO transactions (user_id, ticker, action, shares, execution_price) VALUES ($1, $2, $3, $4, $5)',
                [userId, trueTicker, 'SELL', shares, price]
            );

            return { ticker: trueTicker, price, total: totalValue };
        });

        res.json({ success: true, action: 'SELL', shares, ...fill });
    } catch (error) {
        sendError(res, error, 'Sell transaction failed');
    }
});

// just returns how much cash the logged in user has, used for the "purchasing power" display
app.get('/api/balance/:userId', authGate, verifyAuth, readLimiter, async (req, res) => {
    // req.params.userId is ignored. the id comes from the verified token, so changing the
    // url can't read someone else's balance
    const userId = req.user.id;

    try {
        const result = await pool.query('SELECT cash_balance FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Account not found." });
        }

        res.json({ balance: Number(result.rows[0].cash_balance) });
    } catch (error) {
        sendError(res, error, 'Balance query failed');
    }
});

// returns everything the user currently owns, joined against repositories so we can send
// back the live current price alongside their average entry price
app.get('/api/portfolio/:userId', authGate, verifyAuth, readLimiter, async (req, res) => {
    const userId = req.user.id; // verified token id, not the url param, same as balance

    try {
        const query = `
            SELECT p.ticker, p.shares, p.average_price, r.current_price
            FROM portfolios p
            JOIN repositories r ON p.ticker = r.ticker
            WHERE p.user_id = $1 AND p.shares > 0
        `;
        const result = await pool.query(query, [userId]);
        res.json({ portfolio: result.rows });
    } catch (error) {
        sendError(res, error, 'Portfolio query failed');
    }
});

// repo calls: a prediction that a repo reaches a star target by a deadline, settled
// even-money from the same wallet. the rules are in ./calls.js, and calls are opened and
// judged against the star readings the worker records each pass

// the last week of star readings for a ticker, oldest first, as { at, stars }
async function starReadings(db, ticker) {
    const res = await db.query(
        `SELECT created_at, stars FROM price_history
         WHERE ticker = $1 AND stars IS NOT NULL AND created_at > now() - interval '7 days'
         ORDER BY created_at ASC`,
        [ticker]
    );
    return res.rows.map((r) => ({ at: new Date(r.created_at).getTime(), stars: Number(r.stars) }));
}

// everything the calls form needs to know about a repo before a call is opened: whether it
// can take calls, its star count, and its recent pace (the min target depends on the
// deadline, so the form works it out with the same formula)
async function callQuote(db, ticker, userId) {
    const repo = await findRepo(db, ticker, 'ticker, raw_stars, is_active, source, priced_at');
    if (!repo) throw new TradeError("Not listed.", 404);
    const velocityPerDay = calls.starVelocity(await starReadings(db, repo.ticker));
    const currentStars = Number(repo.raw_stars);
    const pricedAtMs = repo.priced_at ? new Date(repo.priced_at).getTime() : NaN;
    const eligible = calls.eligibility({
        source: repo.source, isActive: repo.is_active, currentStars, pricedAtMs, velocityPerDay,
    });
    const open = await db.query(
        "SELECT COALESCE(SUM(stake), 0) AS open FROM calls WHERE user_id = $1 AND status = 'open'",
        [userId]
    );
    return {
        ticker: repo.ticker,
        currentStars,
        pricedAt: repo.priced_at,
        velocityPerDay,
        eligible: eligible.ok,
        reason: eligible.ok ? null : eligible.error,
        openStake: Number(open.rows[0].open),
        maxOpenStake: calls.MAX_OPEN_STAKE,
        maxStake: calls.MAX_STAKE,
    };
}

app.get('/api/calls/quote/:owner/:repo', authGate, verifyAuth, readLimiter, async (req, res) => {
    const ticker = `${req.params.owner}/${req.params.repo}`;
    if (!isValidTicker(ticker)) {
        return res.status(400).json({ error: "Invalid repository format." });
    }
    try {
        res.json(await callQuote(pool, ticker, req.user.id));
    } catch (error) {
        sendError(res, error, 'Call quote failed');
    }
});

// opens a call: checks the repo can take calls and the target clears its recent pace,
// debits the stake, and records the call, all in one locked transaction like a buy
app.post('/api/calls', authGate, verifyAuth, tradeLimiter, async (req, res) => {
    const { ticker, targetStars, stake, deadline } = req.body || {};
    const userId = req.user.id;

    if (!isValidTicker(ticker)) {
        return res.status(400).json({ error: "Invalid ticker format. Expected 'owner/repo'." });
    }
    const deadlineMs = Date.parse(deadline);
    if (Number.isNaN(deadlineMs)) {
        return res.status(400).json({ error: "Invalid deadline." });
    }

    try {
        const created = await runInTransaction(async (client) => {
            const repo = await findRepo(client, ticker, 'ticker, raw_stars, is_active, source, priced_at');
            if (!repo) throw new TradeError("Not listed.", 404);
            const trueTicker = repo.ticker;
            const currentStars = Number(repo.raw_stars);
            const velocityPerDay = calls.starVelocity(await starReadings(client, trueTicker));

            const eligible = calls.eligibility({
                source: repo.source, isActive: repo.is_active, currentStars,
                pricedAtMs: repo.priced_at ? new Date(repo.priced_at).getTime() : NaN,
                velocityPerDay,
            });
            if (!eligible.ok) throw new TradeError(eligible.error);

            // lock the wallet row first, so two calls opened at once see each other's stake
            const userRes = await client.query('SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows.length === 0) throw new TradeError("Account not found.", 404);
            const open = await client.query(
                "SELECT COALESCE(SUM(stake), 0) AS open FROM calls WHERE user_id = $1 AND status = 'open'",
                [userId]
            );

            const v = calls.validateOpen({
                stake, targetStars, currentStars, velocityPerDay, deadlineMs,
                openStake: Number(open.rows[0].open),
            });
            if (!v.ok) throw new TradeError(v.error);
            if (Number(userRes.rows[0].cash_balance) < v.stake) throw new TradeError("Insufficient purchasing power.");

            await client.query('UPDATE users SET cash_balance = cash_balance - $1 WHERE id = $2', [v.stake, userId]);

            const insert = await client.query(
                `INSERT INTO calls (user_id, ticker, direction, target_stars, stake, deadline, opening_stars)
                 VALUES ($1, $2, 'above', $3, $4, $5, $6)
                 RETURNING id, ticker, direction, target_stars, stake, deadline, status, opening_stars, created_at`,
                [userId, trueTicker, v.targetStars, v.stake, new Date(deadlineMs).toISOString(), currentStars]
            );
            return insert.rows[0];
        });

        res.json({ success: true, call: created });
    } catch (error) {
        sendError(res, error, 'Call open failed');
    }
});

// lists the logged-in user's calls, open ones first, then by deadline. keyed off the
// verified token id
app.get('/api/calls', authGate, verifyAuth, readLimiter, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            `SELECT id, ticker, direction, target_stars, stake, deadline, status,
                    opening_stars, created_at, resolved_at, resolved_stars, payout
             FROM calls WHERE user_id = $1
             ORDER BY (status = 'open') DESC, deadline ASC, created_at DESC`,
            [userId]
        );
        res.json({ calls: result.rows });
    } catch (error) {
        sendError(res, error, 'Calls list failed');
    }
});

// constant-time check of the scheduler's shared secret
function secretMatches(given, expected) {
    if (typeof given !== 'string' || !expected) return false;
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

// settles open calls past their deadline. each call is judged on the first star reading at
// or after its deadline (see resolveStars in ./calls.js). a scheduler calls it, not a user,
// so it's behind a shared secret instead of user auth. SKIP LOCKED lets overlapping runs
// split the work instead of paying out twice, and each call runs inside its own savepoint so
// one bad row can't block everyone else's settlement
app.post('/api/calls/settle', settleLimiter, async (req, res) => {
    if (!secretMatches(req.get('x-cron-secret'), process.env.CRON_SECRET)) {
        return res.status(401).json({ error: "Unauthorized." });
    }

    try {
        const tally = await runInTransaction(async (client) => {
            const due = await client.query(
                `SELECT id, user_id, ticker, direction, target_stars, stake, deadline
                 FROM calls
                 WHERE status = 'open' AND deadline <= now()
                 ORDER BY deadline
                 LIMIT 500
                 FOR UPDATE SKIP LOCKED`
            );

            const counts = { won: 0, lost: 0, void: 0, waiting: 0, failed: 0 };
            for (const row of due.rows) {
                await client.query('SAVEPOINT settle_call');
                try {
                    const after = await client.query(
                        `SELECT stars FROM price_history
                         WHERE ticker = $1 AND stars IS NOT NULL AND created_at >= $2
                         ORDER BY created_at ASC LIMIT 1`,
                        [row.ticker, row.deadline]
                    );
                    const last = await client.query(
                        `SELECT COALESCE(
                            (SELECT stars FROM price_history WHERE ticker = $1 AND stars IS NOT NULL
                             ORDER BY created_at DESC LIMIT 1),
                            (SELECT raw_stars FROM repositories WHERE ticker = $1)
                         ) AS stars`,
                        [row.ticker]
                    );
                    const resolved = calls.resolveStars({
                        deadlineMs: new Date(row.deadline).getTime(),
                        readingAfter: after.rows[0] || null,
                        lastKnownStars: last.rows[0].stars,
                    });

                    if (resolved === 'wait') {
                        counts.waiting++;
                        await client.query('RELEASE SAVEPOINT settle_call');
                        continue;
                    }

                    const decision = resolved === 'void'
                        ? calls.voidRefund({ stake: row.stake })
                        : calls.settle({
                            targetStars: row.target_stars, stake: row.stake,
                            resolvedStars: resolved.stars, direction: row.direction,
                        });

                    const updated = await client.query(
                        `UPDATE calls SET status = $1, payout = $2, resolved_at = now(), resolved_stars = $3
                         WHERE id = $4 AND status = 'open'`,
                        [decision.status, decision.payout, resolved === 'void' ? null : resolved.stars, row.id]
                    );
                    if (updated.rowCount === 1 && decision.payout > 0) {
                        await client.query('UPDATE users SET cash_balance = cash_balance + $1 WHERE id = $2', [decision.payout, row.user_id]);
                    }
                    await client.query('RELEASE SAVEPOINT settle_call');
                    counts[decision.status]++;
                } catch (error) {
                    await client.query('ROLLBACK TO SAVEPOINT settle_call');
                    console.error(`[Ledger Error] Settling call ${row.id} failed: ${error.message}`);
                    counts.failed++;
                }
            }
            return counts;
        });

        res.json(tally);
    } catch (error) {
        sendError(res, error, 'Call settle failed');
    }
});

// price history for the chart on the asset page, plus the metrics behind the current price.
// public and read-only. prices come from the current formula, plus older prices scaled to it,
// which are marked `adjusted` and come with the ratio they were scaled by. the chart draws one
// point per day, so this sends the last price of each day
app.get('/api/history/:owner/:repo', publicLimiter, async (req, res) => {
    const ticker = `${req.params.owner}/${req.params.repo}`;

    if (!isValidTicker(ticker)) {
        return res.status(400).json({ error: "Invalid repository format." });
    }

    try {
        const asset = await findRepo(
            pool, ticker,
            `ticker, current_price, raw_stars, raw_forks, raw_watchers, raw_open_issues, raw_open_prs,
             pushed_at, priced_at, description, source, is_active, pricing_version`
        );
        if (!asset) {
            return res.status(404).json({ error: "Not listed.", listed: false });
        }

        const result = await pool.query(
            `SELECT time, value, adjusted FROM (
                SELECT DISTINCT ON (created_at::date)
                       TO_CHAR(created_at, 'YYYY-MM-DD') AS time, price AS value, created_at,
                       pricing_version = $3 AS adjusted
                FROM price_history
                WHERE ticker = $1 AND pricing_version IN ($2, $3)
                ORDER BY created_at::date, created_at DESC
             ) daily
             ORDER BY created_at ASC`,
            [asset.ticker, PRICING_VERSION, ADJUSTED_VERSION]
        );
        const history = result.rows.map((row) => ({ time: row.time, value: Number(row.value), adjusted: row.adjusted }));

        let adjustment = null;
        if (history.some((p) => p.adjusted)) {
            const adj = await pool.query(
                `SELECT switched_at, ratio FROM price_adjustments
                 WHERE ticker = $1 AND to_version = $2 ORDER BY switched_at DESC LIMIT 1`,
                [asset.ticker, PRICING_VERSION]
            );
            if (adj.rows[0]) adjustment = { switchedAt: adj.rows[0].switched_at, ratio: Number(adj.rows[0].ratio) };
        }

        res.json({ ticker: asset.ticker, pricingVersion: PRICING_VERSION, history, adjustment, asset });
    } catch (error) {
        sendError(res, error, 'History query failed');
    }
});

// github requests for listings added from the app. a token raises the rate limit from 60 an
// hour to 5,000
function github(path) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'trx-ledger' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    return fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(10000) });
}

function githubFailure(status) {
    if (status === 403 || status === 429) {
        return new TradeError("GitHub is rate limiting the exchange. Try again in a few minutes.", 503);
    }
    return new TradeError("GitHub didn't respond. Try again in a minute.", 502);
}

// a public repo's metrics straight from github, the same inputs the worker prices with. the
// open pr count comes from asking for one pr per page and reading the page count out of the
// Link header, and a repo with pull requests turned off (a 404 there) has none open. github
// follows renames, so the ticker that comes back is the canonical one
async function fetchRepoMetrics(ticker) {
    let repoRes;
    try { repoRes = await github(`/repos/${ticker}`); }
    catch { throw githubFailure(502); }
    if (repoRes.status === 404) {
        throw new TradeError("That repository doesn't exist on GitHub, or it's private.", 404);
    }
    if (!repoRes.ok) throw githubFailure(repoRes.status);
    const d = await repoRes.json();
    if (d.private || typeof d.full_name !== 'string' || !isValidTicker(d.full_name)) {
        throw new TradeError("That repository doesn't exist on GitHub, or it's private.", 404);
    }

    let prRes;
    try { prRes = await github(`/repos/${d.full_name}/pulls?state=open&per_page=1`); }
    catch { throw githubFailure(502); }
    let openPrs = 0;
    if (prRes.status !== 404) {
        if (!prRes.ok) throw githubFailure(prRes.status);
        const link = prRes.headers.get('link') || '';
        const last = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
        openPrs = last ? Number(last[1]) : (await prRes.json()).length;
    }

    const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const openIssuesTotal = n(d.open_issues_count); // github counts open prs in here too
    let description = typeof d.description === 'string' ? d.description : '';
    if (description.length > 500) description = description.substring(0, 497) + '...';

    return {
        ticker: d.full_name,
        stars: n(d.stargazers_count),
        forks: n(d.forks_count),
        watchers: n(d.subscribers_count),
        openPrs,
        openIssues: Math.max(0, openIssuesTotal - openPrs),
        pushedAt: d.pushed_at || null,
        description,
        category: typeof d.language === 'string' ? d.language : null,
    };
}

// adds a repo to the signed-in user's own listings. a repo already on the main listings just
// gets pointed at. a repo nobody has listed yet gets priced from github's numbers and seeded
// with one history point. user listings show on that user's board only
app.post('/api/listings', authGate, verifyAuth, tradeLimiter, async (req, res) => {
    const { ticker } = req.body || {};
    const userId = req.user.id;

    if (!isValidTicker(ticker)) {
        return res.status(400).json({ error: "Invalid ticker format. Expected 'owner/repo'." });
    }

    try {
        let repo = await findRepo(pool, ticker, 'ticker, source');
        if (repo && repo.source === 'worker') {
            return res.json({ ticker: repo.ticker, listedOn: 'main' });
        }

        const mine = await pool.query(
            `SELECT count(*)::int AS n,
                    bool_or(lower(ticker) = lower($2)) AS has
             FROM user_listings WHERE user_id = $1`,
            [userId, repo ? repo.ticker : ticker]
        );
        if (mine.rows[0].has) {
            return res.json({ ticker: repo.ticker, listedOn: 'yours' });
        }
        if (mine.rows[0].n >= MAX_USER_LISTINGS) {
            throw new TradeError(`You can add up to ${MAX_USER_LISTINGS} repositories to your listings.`);
        }

        if (!repo) {
            const m = await fetchRepoMetrics(ticker);
            // what was typed can be a rename or a different casing of a repo that's listed
            repo = await findRepo(pool, m.ticker, 'ticker, source');
            if (repo && repo.source === 'worker') {
                return res.json({ ticker: repo.ticker, listedOn: 'main' });
            }
            if (!repo) {
                const price = computePrice({
                    stars: m.stars, forks: m.forks, watchers: m.watchers,
                    openIssues: m.openIssues, openPrs: m.openPrs, pushedAt: m.pushedAt,
                });
                await runInTransaction(async (client) => {
                    const inserted = await client.query(
                        `INSERT INTO repositories (ticker, current_price, description, category, raw_stars,
                                                   raw_forks, raw_watchers, raw_open_issues, raw_open_prs,
                                                   pushed_at, priced_at, is_active, source, pricing_version)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), TRUE, 'user', $11)
                         ON CONFLICT (ticker) DO NOTHING`,
                        [m.ticker, price, m.description, m.category, m.stars, m.forks, m.watchers,
                         m.openIssues, m.openPrs, m.pushedAt, PRICING_VERSION]
                    );
                    if (inserted.rowCount === 1) {
                        await client.query(
                            `INSERT INTO price_history (ticker, price, stars, pricing_version, created_at)
                             VALUES ($1, $2, $3, $4, now())`,
                            [m.ticker, price, m.stars, PRICING_VERSION]
                        );
                    }
                });
                repo = { ticker: m.ticker, source: 'user' };
            }
        }

        await pool.query(
            'INSERT INTO user_listings (user_id, ticker) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, repo.ticker]
        );
        res.json({ ticker: repo.ticker, listedOn: 'yours' });
    } catch (error) {
        sendError(res, error, 'Add listing failed');
    }
});

// the last 10 prices from the current formula for each ticker, oldest first, for the
// sparklines on the board. the lateral join walks the (ticker, created_at) index once per
// ticker instead of ranking the whole history table
async function sparklines(db, tickers) {
    if (tickers.length === 0) return {};
    const res = await db.query(
        `SELECT t.ticker, s.price FROM unnest($1::text[]) AS t(ticker)
         CROSS JOIN LATERAL (
            SELECT price, created_at FROM price_history ph
            WHERE ph.ticker = t.ticker AND ph.pricing_version = $2
            ORDER BY created_at DESC LIMIT 10
         ) s
         ORDER BY t.ticker, s.created_at ASC`,
        [tickers, PRICING_VERSION]
    );
    return res.rows.reduce((acc, row) => {
        (acc[row.ticker] ||= []).push(Number(row.price));
        return acc;
    }, {});
}

// the signed-in user's own listings, in the same shape as a discovery category
app.get('/api/listings/mine', authGate, verifyAuth, readLimiter, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.ticker, r.current_price, r.description, r.category, r.raw_stars
             FROM user_listings ul JOIN repositories r ON r.ticker = ul.ticker
             WHERE ul.user_id = $1 AND r.source = 'user' AND r.is_active = TRUE
             ORDER BY ul.created_at DESC`,
            [req.user.id]
        );
        const lines = await sparklines(pool, result.rows.map((r) => r.ticker));
        res.json({ listings: result.rows.map((r) => ({ ...r, sparkline: lines[r.ticker] || [] })) });
    } catch (error) {
        sendError(res, error, 'Own listings query failed');
    }
});

// in-memory cache so the db sees at most one discovery query every 5 seconds however much
// traffic there is. concurrent misses share the one query that's already running
const CACHE_TTL_MS = 5000;
const discovery = { data: null, at: 0, inflight: null };

async function loadDiscovery() {
    const result = await pool.query(
        `SELECT ticker, current_price, description, category, raw_stars
         FROM repositories WHERE is_active = TRUE AND source = 'worker'
         ORDER BY raw_stars DESC`
    );
    const lines = await sparklines(pool, result.rows.map((r) => r.ticker));

    // dedupe listings of the same repo under different tickers (react/react and
    // facebook/react). github redirects an alias to the canonical repo and returns the
    // same data, so the key is the github node id when the row has one, otherwise
    // stars + mark. when two collide we keep the ticker that isn't the repo named
    // after itself
    const selfNamed = (r) => {
        const [o = "", n = ""] = String(r.ticker).split("/");
        return o.toLowerCase() === n.toLowerCase();
    };
    const identity = (r) => r.github_node_id ?? `${r.raw_stars}:${r.current_price}`;
    const byIdentity = new Map();
    for (const repo of result.rows) {
        const key = identity(repo);
        if (!byIdentity.has(key)) {
            byIdentity.set(key, repo);
        } else {
            // prefer the non-self-named alias (drops react/react for facebook/react)
            const kept = byIdentity.get(key);
            if (selfNamed(kept) && !selfNamed(repo)) byIdentity.set(key, repo);
        }
    }

    // group everything by category so the frontend can render each key as its own
    // board without doing any grouping on its end
    const grouped = {};
    for (const repo of byIdentity.values()) {
        const categoryName = repo.category || "Uncategorized";
        (grouped[categoryName] ||= []).push({ ...repo, sparkline: lines[repo.ticker] || [] });
    }
    discovery.data = grouped;
    discovery.at = Date.now();
    return grouped;
}

// the frontend polls this endpoint every 5 seconds per signed-in tab
const discoveryLimiter = limiter(240, "Too many requests. Wait a moment and try again.");
app.get('/api/discovery', discoveryLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=5');
    if (discovery.data && Date.now() - discovery.at < CACHE_TTL_MS) {
        // x-cache header is handy for debugging in devtools
        res.setHeader('X-Cache', 'HIT');
        return res.json(discovery.data);
    }

    try {
        if (!discovery.inflight) {
            discovery.inflight = loadDiscovery().finally(() => { discovery.inflight = null; });
        }
        const data = await discovery.inflight;
        res.setHeader('X-Cache', 'MISS');
        res.json(data);
    } catch (error) {
        // a failed refresh keeps serving the last good data rather than an error
        if (discovery.data) {
            console.error(`[Ledger Error] Discovery refresh failed, serving stale: ${error.message}`);
            res.setHeader('X-Cache', 'STALE');
            return res.json(discovery.data);
        }
        // table might not exist yet if we haven't run migrations
        if (error.code === '42P01') {
            console.warn(`[Ledger Warning] Repositories table does not exist yet. Returning empty state.`);
            return res.json({});
        }
        sendError(res, error, 'Discovery fetch failed');
    }
});

// unknown routes and malformed bodies get json errors instead of express's html pages
app.use((req, res) => {
    res.status(404).json({ error: "Not found." });
});
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: "Malformed JSON." });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: "Request body too large." });
    sendError(res, error, 'Unhandled');
});

// render sets PORT for us in prod, 8080 is just a fallback for running this locally
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[Ledger] Online on port ${PORT}`));
