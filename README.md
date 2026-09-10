# The Repo Exchange (TRX)

Buy and sell GitHub repos like they're penny stocks. 

### What is it?

TRX is a quantitative trading terminal where you trade GitHub repositories instead of equities. Asset prices are derived from live GitHub metrics—stars, forks, issues, etc. 

Disclaimer: It is entirely simulated. No real money. Just a sandbox to mess around with market mechanics and real-time data.

Every price is a fixed, published function of the repo's public GitHub numbers — the exact formula and a worked example are in [METHODOLOGY.md](METHODOLOGY.md), and each listing's page shows its own mark derived line by line. Nothing is quoted off a wire.

### The Stack

*   **Frontend:** Next.js + Tailwind (deployed on Vercel)
*   **Backend Ledger:** Node.js + Express (deployed on Render)
*   **Data Engine:** Python (deployed on Render)
*   **Database & Auth:** PostgreSQL + Supabase + Resend for SMTP

### Under the Hood

The architecture got a bit complex because real-time trading sims demand low latency and don't tolerate bad data. 

**The Data Engine & GitHub Rate Limits**
I wired up a Python worker that runs 24/7. It hits the GitHub API to hunt for trending repos, ingests their metrics (stars, forks, open issues), and computes a synthetic price. The hardest part here was dealing with GitHub's API rate limits. I had to build in exponential backoff and careful polling intervals to avoid getting timed out. It also handles backfilling historical price data so the charts actually render properly when you load them up.

**Database Protection (Denial of Wallet)**
The Next.js client is thirsty. It polls the backend every 5 seconds for live price updates to keep the terminal feeling alive. Supabase gives you a generous PostgreSQL connection pool, but I was about to nuke it. Had to slap an IP rate-limiter and an in-memory caching layer on the Express API. Now, no matter how many clients are polling, the DB only gets queried once every 5 seconds. Saved my database from going down in flames.

**Auth & Row Level Security**
Wired up Supabase Auth and Resend for magic link emails. I'm leveraging PostgreSQL Row Level Security (RLS) policies pretty heavily. Users can only query their own portfolios and transaction logs directly from the client, keeping the Express backend strictly for the heavy lifting (order routing and market data).

### Design

The interface runs on **Bureau**, a house design system documented in
[BUREAU.md](BUREAU.md). It's institutional deadpan: hairline rules instead of
cards, monospace tabular figures with a real minus sign, one signature chroma
(Signal Amber) that never competes with the bull/bear pair, and a voice that
writes like a clearing house and never admits it's trading JavaScript
runtimes.

Bureau is written to be portable — the token layer, primitives, and figure
formatting know nothing about TRX, and porting it to another project is three
colour values and three font families.

### Roadmap

*   **Zero-Trust Trade Execution:** Right now I need to move trade validation entirely server-side with a strict max slippage tolerance. Client-side state is a lie, and we can't let people edit JSON payloads to buy React for zero dollars. I haven't implemented this yet, but it's next on the list.
*   **WebSockets:** Move away from HTTP polling to a true WebSocket stream for the ticker tape.

