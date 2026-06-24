require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');

class TradeError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'TradeError';
        this.statusCode = statusCode;
    }
}

const TICKER_REGEX = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
function isValidTicker(ticker) {
    return typeof ticker === 'string' && ticker.length <= 140 && TICKER_REGEX.test(ticker);
}

const app = express();
app.set('trust proxy', 1);
const allowedOrigins = process.env.CLIENT_ORIGIN
? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, ''))
  : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

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
app.use(express.json());

// log posts with no origin header, could be someone poking around
app.use((req, res, next) => {
    if (req.method === 'POST' && !req.headers.origin) {
        console.warn(`[Security] POST request without Origin header to ${req.path} from IP ${req.ip}`);
    }
    next();
});

const tradeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: "Too many trade requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
});

const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: "Rate limit exceeded. Please wait a moment." },
    standardHeaders: true,
    legacyHeaders: false,
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const verifyAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        console.warn(`[Auth] Token validation failed: ${error ? error.message : "No user found"}`);
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    req.user = data.user;
    next();
};

app.post('/api/buy', tradeLimiter, verifyAuth, async (req, res) => {
    const { ticker, shares, expectedPrice } = req.body;
    const userId = req.user.id;

    if (typeof expectedPrice !== 'number' || expectedPrice <= 0) {
        return res.status(400).json({ error: "Invalid expected price" });
    }

    if (typeof shares !== 'number' || !Number.isInteger(shares) || shares <= 0 || shares > 1000000) {
        return res.status(400).json({ error: "Invalid share quantity" });
    }

    if (!isValidTicker(ticker)) {
        return res.status(400).json({ error: "Invalid ticker format. Expected 'owner/repo'." });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ilike so we match regardless of how the user typed the casing
        const stockRes = await client.query('SELECT ticker, current_price FROM repositories WHERE ticker ILIKE $1', [ticker]);
        if (stockRes.rows.length === 0) throw new TradeError("Stock not found.", 404);
        const price = stockRes.rows[0].current_price;

        // reject if the price moved more than 1% since the user clicked buy
        if (Math.abs(price - expectedPrice) / expectedPrice > 0.01) {
            throw new TradeError(`Slippage error: Asset price shifted to ${price}. Trade rejected.`);
        }

        const totalCost = Number((price * shares).toFixed(2));
        // this ticker comes from the db so we know it's the right casing
        const trueTicker = stockRes.rows[0].ticker;

        // lock the row so nobody else can mess with the balance mid-trade
        const userRes = await client.query('SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) throw new TradeError("User not found.", 404);
        const cash = userRes.rows[0].cash_balance;

        // making sure the user can actually afford this
        if (cash < totalCost) throw new TradeError("Insufficient funds.");

        await client.query('UPDATE users SET cash_balance = cash_balance - $1 WHERE id = $2', [totalCost, userId]);

        // upsert - if they already own this stock, just add to it and recalc the avg price
        const portfolioQuery = `
            INSERT INTO portfolios (user_id, ticker, shares, average_price)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, ticker)
            DO UPDATE SET
                shares = portfolios.shares + $3,
                average_price = CAST(((portfolios.shares * portfolios.average_price) + ($3 * $4)) / (portfolios.shares + $3) AS NUMERIC(15,2));
        `;
        await client.query(portfolioQuery, [userId, trueTicker, shares, price]);

        await client.query(
            'INSERT INTO transactions (user_id, ticker, action, shares, execution_price) VALUES ($1, $2, $3, $4, $5)',
            [userId, trueTicker, 'BUY', shares, price]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Bought ${shares} shares of ${trueTicker}.` });

    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof TradeError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            console.error(`[Ledger Error] Buy transaction failed: ${error.message}`);
            res.status(500).json({ error: "An internal error occurred. Please try again." });
        }
    } finally {
        client.release();
    }
});

app.post('/api/sell', tradeLimiter, verifyAuth, async (req, res) => {
    const { ticker, shares, expectedPrice } = req.body;
    const userId = req.user.id;

    if (typeof expectedPrice !== 'number' || expectedPrice <= 0) {
        return res.status(400).json({ error: "Invalid expected price" });
    }

    if (typeof shares !== 'number' || !Number.isInteger(shares) || shares <= 0 || shares > 1000000) {
        return res.status(400).json({ error: "Invalid share quantity" });
    }

    if (!isValidTicker(ticker)) {
        return res.status(400).json({ error: "Invalid ticker format. Expected 'owner/repo'." });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ilike so we match regardless of how the user typed the casing
        const stockRes = await client.query('SELECT ticker, current_price FROM repositories WHERE ticker ILIKE $1', [ticker]);
        if (stockRes.rows.length === 0) throw new TradeError("Stock not found.", 404);
        const price = stockRes.rows[0].current_price;

        // reject if the price moved more than 1% since the user clicked sell
        if (Math.abs(price - expectedPrice) / expectedPrice > 0.01) {
            throw new TradeError(`Slippage error: Asset price shifted to ${price}. Trade rejected.`);
        }

        // this ticker comes from the db so we know it's the right casing
        const trueTicker = stockRes.rows[0].ticker;
        const totalValue = Number((price * shares).toFixed(2));

        // lock the row and make sure they actually own enough shares
        const portRes = await client.query('SELECT shares FROM portfolios WHERE user_id = $1 AND ticker = $2 FOR UPDATE', [userId, trueTicker]);
        if (portRes.rows.length === 0 || portRes.rows[0].shares < shares) {
            throw new TradeError("Insufficient shares to sell.");
        }

        await client.query('UPDATE users SET cash_balance = cash_balance + $1 WHERE id = $2', [totalValue, userId]);

        await client.query('UPDATE portfolios SET shares = shares - $1 WHERE user_id = $2 AND ticker = $3', [shares, userId, trueTicker]);

        await client.query(
            'INSERT INTO transactions (user_id, ticker, action, shares, execution_price) VALUES ($1, $2, $3, $4, $5)',
            [userId, trueTicker, 'SELL', shares, price]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Sold ${shares} shares of ${trueTicker}.` });

    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof TradeError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            console.error(`[Ledger Error] Sell transaction failed: ${error.message}`);
            res.status(500).json({ error: "An internal error occurred. Please try again." });
        }
    } finally {
        client.release();
    }
});

app.get('/api/balance/:userId', readLimiter, verifyAuth, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query('SELECT cash_balance FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json({ balance: Number(result.rows[0].cash_balance) });
    } catch (error) {
        console.error(`[Ledger Error] Balance query failed: ${error.message}`);
        res.status(500).json({ error: "Could not fetch balance data." });
    }
});

app.get('/api/portfolio/:userId', readLimiter, verifyAuth, async (req, res) => {
    const userId = req.user.id;

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
        console.error(`[Ledger Error] Portfolio query failed: ${error.message}`);
        res.status(500).json({ error: "Could not fetch portfolio data." });
    }
});

app.get('/api/history/:owner/:repo', readLimiter, async (req, res) => {
    const { owner, repo } = req.params;
    const ticker = `${owner}/${repo}`;

    if (!isValidTicker(ticker)) {
        return res.status(400).json({ error: "Invalid repository format." });
    }

    try {
        const result = await pool.query(
            "SELECT TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS full_time, TO_CHAR(created_at, 'YYYY-MM-DD') AS time, price AS value FROM price_history WHERE ticker ILIKE $1 ORDER BY created_at ASC",
            [ticker]
        );

        if (result.rows.length > 0) {
            const formattedHistory = result.rows.map(row => ({
                time: row.time,
                value: Number(row.value)
            }));
            return res.json({ history: formattedHistory });
        }

        // no history yet, so we go grab it from github and seed it
        const githubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (githubRes.status === 404) {
            return res.status(404).json({ error: "Repository not found on GitHub" });
        }
        if (!githubRes.ok) {
            return res.status(500).json({ error: "Error fetching repository data from GitHub." });
        }

        const githubData = await githubRes.json();
        const stargazers_count = typeof githubData.stargazers_count === 'number' ? githubData.stargazers_count : 0;
        let description = typeof githubData.description === 'string' ? githubData.description : '';
        if (description.length > 500) description = description.substring(0, 497) + '...';
        const language = githubData.language;
        const current_price = stargazers_count / 100;
        const category = language || "Unknown";

        await pool.query(
            `INSERT INTO repositories (ticker, current_price, description, category, raw_stars, is_active)
             VALUES ($1, $2, $3, $4, $5, TRUE)
             ON CONFLICT (ticker)
             DO UPDATE SET
                current_price = EXCLUDED.current_price,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                raw_stars = EXCLUDED.raw_stars,
                is_active = TRUE`,
            [ticker, current_price, description, category, stargazers_count]
        );

        const historyInsert = await pool.query(
            "INSERT INTO price_history (ticker, price, created_at) VALUES ($1, $2, NOW()) RETURNING TO_CHAR(created_at, 'YYYY-MM-DD') AS time",
            [ticker, current_price]
        );

        return res.json({ history: [{ time: historyInsert.rows[0].time, value: current_price }] });
    } catch (error) {
        console.error(`[Ledger Error] History query failed: ${error.message}`);
        res.status(500).json({ error: "Could not fetch history data." });
    }
});

const discoveryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: "Rate limit exceeded. Please wait a moment." },
    standardHeaders: true,
    legacyHeaders: false,
});

// simple in-memory cache so we don't hammer the db on every request
// worst case we query once every 5 seconds no matter how much traffic we get
let cachedDiscoveryData = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5000;

app.get('/api/discovery', discoveryLimiter, async (req, res) => {
    const now = Date.now();

    if (cachedDiscoveryData && (now - lastCacheTime < CACHE_TTL_MS)) {
        // x-cache header is handy for debugging in devtools
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedDiscoveryData);
    }

    try {
        const result = await pool.query('SELECT ticker, current_price, description, category, raw_stars FROM repositories WHERE is_active = TRUE ORDER BY raw_stars DESC');

        if (!result.rows || result.rows.length === 0) {
            return res.json({});
        }

        const groupedData = result.rows.reduce((acc, repo) => {
            const categoryName = repo.category || "Uncategorized";
            if (!acc[categoryName]) {
                acc[categoryName] = [];
            }
            acc[categoryName].push(repo);
            return acc;
        }, {});

        cachedDiscoveryData = groupedData;
        lastCacheTime = now;

        res.setHeader('X-Cache', 'MISS');
        res.json(cachedDiscoveryData);
    } catch (error) {
        // table might not exist yet if we haven't run migrations
        if (error.code === '42P01') {
            console.warn(`[Ledger Warning] Repositories table does not exist yet. Returning empty state.`);
            return res.json({});
        }

        console.error("[DB ERROR] Discovery fetch failed:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(8080, () => console.log(`[Ledger] Online on port 8080`));
