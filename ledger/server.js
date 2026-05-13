require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

app.post('/api/buy', async (req, res) => {
    const { userId, ticker, shares } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // start transaction

        // current price
        const stockRes = await client.query('SELECT current_price FROM repositories WHERE ticker = $1', [ticker]);
        if (stockRes.rows.length === 0) throw new Error("Stock not found.");
        const price = stockRes.rows[0].current_price;
        const totalCost = price * shares;

        // balcance check
        const userRes = await client.query('SELECT cash_balance FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) throw new Error("User not found.");
        const cash = userRes.rows[0].cash_balance;

        if (cash < totalCost) throw new Error("Insufficient funds.");

        // deduction for when user buys stocks
        await client.query('UPDATE users SET cash_balance = cash_balance - $1 WHERE id = $2', [totalCost, userId]);

        //upsert portfolio
        const portfolioQuery = `
            INSERT INTO portfolios (user_id, ticker, shares, average_price)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, ticker)
            DO UPDATE SET 
                shares = portfolios.shares + $3,
                average_price = ((portfolios.shares * portfolios.average_price) + ($3 * $4)) / (portfolios.shares + $3);
        `;
        await client.query(portfolioQuery, [userId, ticker, shares, price]);

        // logging of transaction
        await client.query(
            'INSERT INTO transactions (user_id, ticker, action, shares, execution_price) VALUES ($1, $2, $3, $4, $5)',
            [userId, ticker, 'BUY', shares, price]
        );

        await client.query('COMMIT'); // done with all queries, commit the transaction
        res.json({ success: true, message: `Bought ${shares} shares of ${ticker}.` });

    } catch (error) {
        await client.query('ROLLBACK'); // refunds incase of error
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.get('/api/balance/:userId', async (req, res) => {
    const { userId } = req.params;
    
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

app.get('/api/portfolio/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT ticker, shares, average_price FROM portfolios WHERE user_id = $1 AND shares > 0',
            [userId]
        );
        res.json({ portfolio: result.rows });
    } catch (error) {
        console.error(`[Ledger Error] Portfolio query failed: ${error.message}`);
        res.status(500).json({ error: "Could not fetch portfolio data." });
    }
});

app.get('/api/history/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    const ticker = `${owner}/${repo}`.toUpperCase();
    
    try {
        const result = await pool.query(
            "SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS time, price AS value FROM price_history WHERE ticker = $1 ORDER BY created_at ASC",
            [ticker]
        );
        //filtering out duplicate dates (keep the latest price of the day)
        // keeping one price per day
        const uniqueHistory = [];
        const seenDates = new Set();
        
        //keeping latest price of day by iterating in reverse (latest first)
        const reversedRows = [...result.rows].reverse();
        
        for (const row of reversedRows) {
            if (!seenDates.has(row.time)) {
                seenDates.add(row.time);
                uniqueHistory.push({ time: row.time, value: Number(row.value) });
            }
        }
        
        // reversing to chronological order
        uniqueHistory.reverse();

        res.json({ history: uniqueHistory });
    } catch (error) {
        console.error(`[Ledger Error] History query failed: ${error.message}`);
        res.status(500).json({ error: "Could not fetch history data." });
    }
});

app.get('/api/discovery', async (req, res) => {
    try {
        const result = await pool.query('SELECT ticker, current_price, description, category, raw_stars FROM repositories');
        const grouped = result.rows.reduce((acc, repo) => {
            if (!acc[repo.category]) {
                acc[repo.category] = [];
            }
            acc[repo.category].push(repo);
            return acc;
        }, {});
        res.json(grouped);
    } catch (error) {
        console.error(`[Ledger Error] Discovery query failed: ${error.message}`);
        res.status(500).json({ error: "Could not fetch discovery data." });
    }
});

app.listen(8080, () => console.log(`[Ledger] Online on port 8080`));