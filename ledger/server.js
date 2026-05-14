require('dotenv').config(); // load environment variables from .env file
const express = require('express'); // web framework for building the API
const cors = require('cors'); // middleware for handling CORS
const { Pool } = require('pg'); // postgres client for database interactions

const app = express(); // create an Express application instance
app.use(cors()); //enabling cors ew
app.use(express.json()); //middleware for json parsing

const pool = new Pool({ //create postgress connction pool 
    connectionString: process.env.DATABASE_URL, //haha you wont get it!
});

app.post('/api/buy', async (req, res) => { // ENDPOINT for buying stocks
    const { userId, ticker, shares } = req.body; // extract userId, ticker, and shares from the request body
    const client = await pool.connect(); // get a client from the connection pool

    try {
        await client.query('BEGIN'); // start transaction

        // current price
        const stockRes = await client.query('SELECT ticker, current_price FROM repositories WHERE ticker ILIKE $1', [ticker]); // query the repositories table to get the current price of the stock (using ILIKE for case sensiticity)
        if (stockRes.rows.length === 0) throw new Error("Stock not found.");
        const price = stockRes.rows[0].current_price; // get the current price of the stock from the repositories table
        const totalCost = price * shares; // calculate the total cost of the purchase (price * shares)
        const trueTicker = stockRes.rows[0].ticker; // get the exact ticker from DB (case-sensitive)

        // balcance check
        const userRes = await client.query('SELECT cash_balance FROM users WHERE id = $1', [userId]); // query the users table to get the cash balance of the user
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
                average_price = ((portfolios.shares * portfolios.average_price) + ($3 * $4)) / (portfolios.shares + $3);
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

app.post('/api/sell', async (req, res) => { // ENDPOINT for selling stocks
    const { userId, ticker, shares } = req.body; // extract userId, ticker, and shares from the request body
    const client = await pool.connect(); // get a client from the connection pool

    try {
        await client.query('BEGIN'); // start transaction

        // current price
        const stockRes = await client.query('SELECT ticker, current_price FROM repositories WHERE ticker ILIKE $1', [ticker]); // query the repositories table to get the current price of the stock (using ILIKE for case sensiticity)
        if (stockRes.rows.length === 0) throw new Error("Stock not found.");
        const price = stockRes.rows[0].current_price; // get the current price of the stock from the repositories table
        const trueTicker = stockRes.rows[0].ticker; // get the exact ticker from DB (case-sensitive)
        const totalValue = price * shares;

        // portfolio check
        const portRes = await client.query('SELECT shares FROM portfolios WHERE user_id = $1 AND ticker = $2', [userId, trueTicker]); // query the portfolios table to get the number of shares the user owns for the specified stock
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

app.get('/api/balance/:userId', async (req, res) => { // ENDPOINT for fetching user's cash balance
    const { userId } = req.params; // extract userId from the request parameters
    
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

app.get('/api/portfolio/:userId', async (req, res) => { // ENDPOINT for fetching user's portfolio (stocks owned)
    const { userId } = req.params; // extract userId from the request parameters
    
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
    const { period } = req.query; // extract period from the query parameters to determine the time range for the price history (e.g., 1D, 1W, 1M, 1Y) ===== BETA NOT WOKRING!!!=====
    const ticker = `${owner}/${repo}`;
    
    try {
        const result = await pool.query(
            "SELECT TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS full_time, TO_CHAR(created_at, 'YYYY-MM-DD') AS time, price AS value FROM price_history WHERE ticker ILIKE $1 ORDER BY created_at ASC",
            [ticker] 
        );
        
        let uniqueHistory = []; // this will hold the filtered price history data based on the specified period

        if (period === '1D') {
            // Return the last 24 rows (hourly data points)
            const last24 = result.rows.slice(-24);
            uniqueHistory = last24.map(row => ({ 
                time: row.time, 
                value: Number(row.value)
            }));
        } else {
            // Filtering out duplicate dates (keep the latest price of the day)
            const seenDates = new Set();
            const dailyData = [];
            
            // keeping latest price of day by iterating in reverse (latest first)
            const reversedRows = [...result.rows].reverse();
            
            for (const row of reversedRows) {
                if (!seenDates.has(row.time)) {
                    seenDates.add(row.time);
                    dailyData.push({ time: row.time, value: Number(row.value) });
                }
            }
            
            // reversing to chronological order
            dailyData.reverse();

            if (period === '1W') {
                uniqueHistory = dailyData.slice(-7); // get the last 7 unique daily data points for 1 week history
            } else if (period === '1M') {
                uniqueHistory = dailyData.slice(-30); // get the last 30 unique daily data points for 1 month history
            } else if (period === '1Y') {
                uniqueHistory = dailyData.slice(-365); // get the last 365 unique daily data points for 1 year history
            } else {
                uniqueHistory = dailyData; // if no valid period is specified, return all unique daily data points (default to full history)
            }
        }

        res.json({ history: uniqueHistory }); // respond with the filtered price history data in JSON format, where each entry contains the time and value (price) for that time point
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
        res.status(500).json({ error: "Could not fetch discovery data." });
    }
});

app.listen(8080, () => console.log(`[Ledger] Online on port 8080`)); // start the Express server and listen on port 8080, logging a message to the console when the server is online