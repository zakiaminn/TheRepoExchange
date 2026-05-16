require('dotenv').config(); // load environment variables from .env file
const express = require('express'); // web framework for building the API
const cors = require('cors'); // middleware for handling CORS
const { Pool } = require('pg'); // postgres client for database interactions
const { createClient } = require('@supabase/supabase-js');

const app = express(); // create an Express application instance
const allowedOrigins = process.env.CLIENT_ORIGIN
? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, ''))
  : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow server-to-server or tools like Postman/Curl (which have no origin header)
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
app.use(express.json()); //middleware for json parsing

const pool = new Pool({ //create postgress connction pool 
    connectionString: process.env.DATABASE_URL, //haha you wont get it!
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
        return res.status(401).json({ error: "Unauthorized: Invalid token", details: error ? error.message : "No user found" });
    }
    
    req.user = data.user;
    next();
};

app.post('/api/buy', verifyAuth, async (req, res) => { // ENDPOINT for buying stocks
    const { ticker, shares, expectedPrice } = req.body; // extract ticker, and shares from the request body
    const userId = req.user.id;

    if (typeof expectedPrice !== 'number' || expectedPrice <= 0) {
        return res.status(400).json({ error: "Invalid expected price" });
    }

    if (typeof shares !== 'number' || !Number.isInteger(shares) || shares <= 0) {
        return res.status(400).json({ error: "Invalid share quantity" });
    }

    const client = await pool.connect(); // get a client from the connection pool

    try {
        await client.query('BEGIN'); // start transaction

        // current price
        const stockRes = await client.query('SELECT ticker, current_price FROM repositories WHERE ticker ILIKE $1', [ticker]); // query the repositories table to get the current price of the stock (using ILIKE for case sensiticity)
        if (stockRes.rows.length === 0) throw new Error("Stock not found.");
        const price = stockRes.rows[0].current_price; // get the current price of the stock from the repositories table
        
        if (Math.abs(price - expectedPrice) / expectedPrice > 0.01) {
            throw new Error(`Slippage error: Asset price shifted to ${price}. Trade rejected.`);
        }

        const totalCost = Number((price * shares).toFixed(2)); // calculate the total cost of the purchase (price * shares)
        const trueTicker = stockRes.rows[0].ticker; // get the exact ticker from DB (case-sensitive)

        // balcance check
        const userRes = await client.query('SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE', [userId]); // query the users table to get the cash balance of the user
        if (userRes.rows.length === 0) throw new Error("User not found."); // if user is not found in the users table, throw an error
        const cash = userRes.rows[0].cash_balance; // get the cash balance of the user from the users table

        if (cash < totalCost) throw new Error("Insufficient funds."); // if broke -> cant buy lol

        // deduction for when user buys stocks
        await client.query('UPDATE users SET cash_balance = cash_balance - $1 WHERE id = $2', [totalCost, userId]);

        //upsert portfolio
        const portfolioQuery = `
            INSERT INTO portfolios (user_id, ticker, shares, average_price) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, ticker)
            DO UPDATE SET 
                shares = portfolios.shares + $3,
                average_price = CAST(((portfolios.shares * portfolios.average_price) + ($3 * $4)) / (portfolios.shares + $3) AS NUMERIC(15,2));
        `;
        await client.query(portfolioQuery, [userId, trueTicker, shares, price]);

        // logging of transaction
        await client.query(
            'INSERT INTO transactions (user_id, ticker, action, shares, execution_price) VALUES ($1, $2, $3, $4, $5)',
            [userId, trueTicker, 'BUY', shares, price]
        );

        await client.query('COMMIT'); // done with all queries, commit the transaction
        res.json({ success: true, message: `Bought ${shares} shares of ${trueTicker}.` });

    } catch (error) { 
        await client.query('ROLLBACK'); // refunds incase of error
        res.status(500).json({ error: error.message });
    } finally {
        client.release(); // release the client back to the pool
    }
});

app.post('/api/sell', verifyAuth, async (req, res) => { // ENDPOINT for selling stocks
    const { ticker, shares, expectedPrice } = req.body; // extract ticker, and shares from the request body
    const userId = req.user.id;

    if (typeof expectedPrice !== 'number' || expectedPrice <= 0) {
        return res.status(400).json({ error: "Invalid expected price" });
    }

    if (typeof shares !== 'number' || !Number.isInteger(shares) || shares <= 0) {
        return res.status(400).json({ error: "Invalid share quantity" });
    }

    const client = await pool.connect(); // get a client from the connection pool

    try {
        await client.query('BEGIN'); // start transaction

        // current price
        const stockRes = await client.query('SELECT ticker, current_price FROM repositories WHERE ticker ILIKE $1', [ticker]); // query the repositories table to get the current price of the stock (using ILIKE for case sensiticity)
        if (stockRes.rows.length === 0) throw new Error("Stock not found.");
        const price = stockRes.rows[0].current_price; // get the current price of the stock from the repositories table
        
        if (Math.abs(price - expectedPrice) / expectedPrice > 0.01) {
            throw new Error(`Slippage error: Asset price shifted to ${price}. Trade rejected.`);
        }

        const trueTicker = stockRes.rows[0].ticker; // get the exact ticker from DB (case-sensitive)
        const totalValue = Number((price * shares).toFixed(2));

        // portfolio check
        const portRes = await client.query('SELECT shares FROM portfolios WHERE user_id = $1 AND ticker = $2 FOR UPDATE', [userId, trueTicker]); // query the portfolios table to get the number of shares the user owns for the specified stock
        if (portRes.rows.length === 0 || portRes.rows[0].shares < shares) { 
            throw new Error("Insufficient shares to sell."); // lol you're broke in stocks too?
        }

        // update cash balance
        await client.query('UPDATE users SET cash_balance = cash_balance + $1 WHERE id = $2', [totalValue, userId]);

        // update portfolio
        await client.query('UPDATE portfolios SET shares = shares - $1 WHERE user_id = $2 AND ticker = $3', [shares, userId, trueTicker]);

        // logging of transaction
        await client.query(
            'INSERT INTO transactions (user_id, ticker, action, shares, execution_price) VALUES ($1, $2, $3, $4, $5)',
            [userId, trueTicker, 'SELL', shares, price] // log the sell transaction in the transactions table with action 'SELL' and the execution price at which the stock was sold
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Sold ${shares} shares of ${trueTicker}.` }); // respond with a success message indicating the number of shares sold and the ticker symbol

    } catch (error) {
        await client.query('ROLLBACK'); // refunds incase of error
        res.status(500).json({ error: error.message }); 
    } finally {
        client.release(); // release the client back to the pool
    }
});

app.get('/api/balance/:userId', verifyAuth, async (req, res) => { // ENDPOINT for fetching user's cash balance
    const userId = req.user.id;
    
    try {
        const result = await pool.query('SELECT cash_balance FROM users WHERE id = $1', [userId]); // query the users table to get the cash balance of the user with the specified userId
        
        if (result.rows.length === 0) { 
            return res.status(404).json({ error: "User not found." }); // if user is not found in the users table, respond with a 404 error
        }
        
        res.json({ balance: Number(result.rows[0].cash_balance) }); // respond with the cash balance of the user in JSON format, converting it to a number for consistency
    } catch (error) {
        console.error(`[Ledger Error] Balance query failed: ${error.message}`); // log any errors that occur during the database query for fetching the user's cash balance
        res.status(500).json({ error: "Could not fetch balance data." }); // respond with a 500 error if there was an issue fetching the balance data from the database
    }
});

app.get('/api/portfolio/:userId', verifyAuth, async (req, res) => { // ENDPOINT for fetching user's portfolio (stocks owned)
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

app.get('/api/history/:owner/:repo', async (req, res) => { // ENDPOINT for fetching price history of a stock (repository) based on the owner and repo name
    const { owner, repo } = req.params; // extract owner and repo from the request parameters
    const ticker = `${owner}/${repo}`;
    
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

        const githubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (githubRes.status === 404) {
            return res.status(404).json({ error: "Repository not found on GitHub" });
        }
        if (!githubRes.ok) {
            return res.status(500).json({ error: "Error fetching repository data from GitHub." });
        }
        
        const githubData = await githubRes.json();
        const { stargazers_count, description, language } = githubData;
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

app.get('/api/discovery', async (req, res) => { // ENDPOINT for fetching discovery data (list of repositories with their current price, description, category, and raw stars, grouped by category)
    try {
        const result = await pool.query('SELECT ticker, current_price, description, category, raw_stars FROM repositories');
        const grouped = result.rows.reduce((acc, repo) => {
            if (!acc[repo.category]) { // if the category does not exist in the accumulator object
                acc[repo.category] = []; //initialize it with an empty array
            }
            acc[repo.category].push(repo); 
            return acc;
        }, {});
        res.json(grouped); // respond with the discovery data grouped by category in JSON format, where each key is a category and the value is an array of repositories belonging to that category, including their ticker, current price, description, and raw stars
    } catch (error) {
        console.error(`[Ledger Error] Discovery query failed: ${error.message}`);
        res.status(500).json({ error: "Could not fetch discovery data.", details: error.message });
    }
});

app.listen(8080, () => console.log(`[Ledger] Online on port 8080`)); // start the Express server and listen on port 8080, logging a message to the console when the server is online