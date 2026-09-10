# The Repo Exchange (TRX)

A simulated exchange where you trade GitHub repositories like securities. Every listing's price is a fixed, published function of the repo's live GitHub numbers — so any price on the board can be checked, by hand, against the public data it came from.

**Live:** [therepo.exchange](https://therepo.exchange)

> Entirely simulated. No real money, no securities, nothing to hold. It's a sandbox for market mechanics on real, real-time data.

### What is it?

You open an account, get $100,000 of fictional capital, and buy and sell positions in real repositories. Prices track live GitHub activity. On top of the market sits **Repo Calls** — a prediction market where you stake capital on a repo hitting a star target by a deadline, and the position settles automatically against the public star count.

The point isn't the money (there isn't any). It's that the whole thing is *verifiable*: no invented numbers, no quotes off a wire, nothing you have to take on faith.

### Pricing is published, not conjured

Every mark is a function of six public GitHub metrics — stars, forks, watchers, open PRs, open issues, and last-push recency — combined by one fixed formula, versioned as **PRICING-1**. The exact weights, the formula, and a worked example are in [METHODOLOGY.md](METHODOLOGY.md), and every listing's page shows its own price derived line by line, reconciling to the mark. Point a second tab at GitHub and you can reproduce any number on the board.

### Repo Calls (prediction market)

A repo's price barely moves day to day, but its star count moves a lot over weeks — so the interesting bet is directional and time-boxed. A call is a prediction: *"`oven-sh/bun` reaches 80,000 stars by a given date."* You stake simulated capital, and at the deadline a resolver settles it against the public star count — even-money, so a correct call returns twice the stake and a wrong one forfeits it. Your book of calls builds a forecasting track record over time.

### The Stack

*   **Frontend:** Next.js + Tailwind (Vercel)
*   **Backend Ledger:** Node.js + Express (Render)
*   **Data Engine:** Python worker on an hourly cron (GitHub Actions)
*   **Database & Auth:** PostgreSQL + Supabase, Resend for email

### Under the Hood

Real-time trading sims demand low latency and don't tolerate bad data, which is where most of the engineering went.

**The Data Engine & GitHub rate limits.** A Python worker hunts trending repos, ingests their metrics, and computes each mark from the published formula. The hard part is GitHub's rate limits — the worker uses exponential backoff and careful polling intervals to stay inside them. Price history isn't fabricated: a new listing starts at a single real mark and its chart fills in for real as the worker polls, because every point on a chart has to be a price the formula actually produced.

**One formula, two runtimes, no drift.** The pricing formula lives in both the Node ledger and the Python worker. To stop them diverging, both import a single canonical module in their own language, and both are pinned to a shared fixture of `input → expected price` cases that each side asserts against in its own test. Fixing this also closed two real parity bugs — one pricer measured recency in fractional days while the other floored to whole days, and the two rounded half-cents differently.

**Database protection (denial of wallet).** The client polls for live prices every 5 seconds to keep the terminal feeling alive. Left alone, that many clients would hammer the Postgres connection pool, so the Express API sits behind an IP rate-limiter and an in-memory cache: no matter how many clients are polling, the database is queried at most once every 5 seconds.

**Server-authoritative trades.** Trade validation is entirely server-side. The client's price is never trusted — the ledger re-reads the live mark, rejects the order if it has drifted beyond tolerance since submission (slippage is rejected, not absorbed), and runs every fill in one transaction with row-level locking so two concurrent orders can't race the same balance.

**Auto-settling calls.** Calls are settled by an idempotent resolver: an hourly job asks the ledger to settle every open call past its deadline, judged against the latest public star count, crediting winners and refunding voids. It locks its working set with `SKIP LOCKED` so overlapping runs divide the work instead of double-paying, and the settlement math is a pure, unit-tested module.

**Auth & Row Level Security.** Supabase Auth handles sign-in. PostgreSQL Row Level Security lets the client read its own portfolio, transactions, and calls directly, while the Express backend does the privileged work — order routing, settlement, and market data.

### Design

The interface is deliberately plain: hairline rules instead of cards, and a strict split between text and figures. Words are set in **Bricolage Grotesque**; numbers — every price, count, and delta — in **Spline Sans Mono** with tabular figures and a real typographic minus sign, so columns line up and a falling number reads as one. One accent colour, **Sulfur** (`#DCEC3A`, an acid chartreuse) on **Chalk** (`#FAFAF9`), carries the signal and never competes with the bull/bear pair. The palette reasons explicitly about contrast — text tiers clear WCAG AA on the ground. The voice is plain and exact: it states what's true about the market and stops.

### Roadmap

*   **Derived odds for calls (v2):** even-money is a flat, stated rule, not real odds. The honest version prices each call from the repo's trailing star velocity against the distance-to-target and time-to-deadline — verifiable odds, the same way prices are verifiable. It needs star-velocity history the engine will start recording first.
*   **WebSockets:** move the live ticker from HTTP polling to a real WebSocket stream.
