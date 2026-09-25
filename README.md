# The Repo Exchange (TRX)

TRX is a simulated market where GitHub repositories trade like stocks. Each price comes from six public numbers on the repo (stars, forks, watchers, open pull requests, open issues and the date of the last push) put through one formula that lives in this repo, so you can check any price against GitHub yourself.

**Live:** [therepo.exchange](https://therepo.exchange)

> Everything is simulated. Accounts start with $100,000 of play money that can't be deposited, withdrawn or transferred, and no listing is a security.

## How it works

You sign up, get $100,000 of simulated cash, and buy and sell shares in repositories. A worker recalculates every price once an hour from the GitHub API. You can also open calls: stake cash on a repo reaching a star count by a date, settled against GitHub's count after the deadline.

I built it so every number can be checked. Each listing page shows its price worked out line by line from the public inputs, and the lines add up to the price you trade at.

The main listings come from four GitHub searches the worker runs every hour (machine learning, Rust and C++, TypeScript and JavaScript, and repos created in the last 30 days). You can also add any public repo to your own listings. It's priced the same way, and it only shows up on your listings page.

## Pricing

The formula is versioned (currently PRICING-2):

```
gross = 5.00
      + 0.001 × stars
      + 0.01  × forks
      + 0.05  × watchers
      + 1.00  × ln(1 + open PRs)

issue drag = min(1.00 × ln(1 + open issues), 0.6 × gross)

price = max(1.00, (gross - issue drag) × recency)
```

Recency is 1.00 until 30 days after the last push, then falls in a straight line to 0.70 at a year. Prices round to the cent.

Open PRs and issues are log-scaled so they can't dominate the price. A repo with 5,000 open PRs gets about $8.50 from them, so spamming a repo with PRs or issues barely moves its price.

Worked example: 10,000 stars, 500 forks, 300 watchers, 20 open PRs, 10 open issues, pushed recently.

```
5.00 + 10.00 + 5.00 + 15.00 + ln(21) - ln(11) = 35.65
```

The formula is in [ledger/pricing.js](ledger/pricing.js), [data-engine/pricing.py](data-engine/pricing.py) and [frontend/src/lib/pricing.ts](frontend/src/lib/pricing.ts). All three are tested against the same cases in [pricing/fixtures.json](pricing/fixtures.json).

## Calls

A repo's price moves slowly, but its star count can move a lot in a few weeks. A call is a bet on that: "facebook/react reaches 260,000 stars by 1 December". It's even money for now, so a correct call pays twice the stake and a wrong one loses it.

Even money only works if the target isn't a sure thing, so the ledger sets a floor on it:

- Calls are open on the main listings only, for repos with at least 1,000 stars.
- A repo needs a day of star history first, and its latest star count has to be under two hours old.
- The target has to be at least today's stars, plus the repo's recent daily growth projected to the deadline, plus 1%. So a call is a bet that the repo beats its own trend.
- Stakes are capped at $10,000 per call and $10,000 across your open calls.

After the deadline, the call is judged on the first star count the worker records. If none comes in within six hours (the repo went private, or was deleted), it's judged on the last count on record. Hiding a repo can't turn a losing call into a refund.

The rules are in [ledger/calls.js](ledger/calls.js), with tests in [ledger/calls.test.js](ledger/calls.test.js).

## Stack

- **Frontend:** Next.js and Tailwind, on Vercel
- **Ledger:** Node and Express, on Render
- **Worker:** Python, run hourly by GitHub Actions
- **Database and auth:** Postgres and Supabase Auth, with Resend for email

## Engineering notes

#### GitHub rate limits

The worker makes a few hundred GitHub requests per run: one per listing for its metrics and one for its open PR count. It reads the PR count from the pagination header of a one-item page, so a repo with 5,000 open PRs still costs one request. Rate-limited requests, server errors and dropped connections back off exponentially, and GitHub's `Retry-After` or reset time wins when it sends one. Each listing commits on its own, so a run that gets cut off keeps what it already priced.

#### One formula in three places

The ledger prices repos people add, the worker prices everything each hour, and the frontend rebuilds the price on each listing page. All three are tested against the same fixture cases. Setting that up turned up two places where the Node and Python copies disagreed: one measured recency in fractional days and the other in whole days, and they rounded half-cents differently.

#### Price history

A new listing starts with a single price and the worker adds one every hour. Each point records which formula version made it. From 25 September on, every point is a price PRICING-2 produced.

Before that, the worker ran the previous formula. Its prices from 27 August (when that formula came in) up to the switch are scaled to PRICING-2 by each listing's own price change at the switch, the way stock charts adjust for a split, and the listing page says so under the chart. It's an approximation: one ratio per listing can't account for how its open PRs and issues moved over that month. Open positions' entry prices were scaled the same way, so the switch didn't show up as anyone's gain or loss.

Some history is left out. Before 27 August, a second copy of the worker was writing prices from a different formula at the same time, and the two can't be told apart. A few small repos whose old prices swung with every batch of PRs have no older history either. The ratios are stored with the data, and [data-engine/backfill.py](data-engine/backfill.py) is the script that did it.

The worker also records the star count with each point, and calls are settled against those readings.

#### Polling and the database

When you're signed in, the listings page asks the ledger for prices every five seconds, and pauses while the tab is hidden. The ledger caches that response for five seconds, and requests that arrive during a refresh wait on the same query. So Postgres sees at most one listings query every five seconds, however many tabs are open. Rate limits count per visitor, using the client address Cloudflare passes along, or per account once you're signed in.

#### Trades are checked on the server

The client's price is never trusted. The ledger re-reads the price, rejects the order if it moved more than 1% since you opened the ticket, and fills it in one transaction. That transaction locks your account row before the holding, so two orders can't spend the same cash, and it retries if Postgres aborts it to break a deadlock. The response carries the price you actually got.

#### Settling calls

An hourly job settles calls past their deadline. It claims rows with `SKIP LOCKED` and only touches calls that are still open, so overlapping runs split the work instead of paying twice. Each call settles inside its own savepoint, so one bad row can't hold up everyone else's.

#### Auth

Supabase handles sign-in. The browser never queries the database: every read and write goes through the ledger, which verifies the Supabase token and uses the user id inside it. Row level security is on for every table as a second layer.

## Design

Words are set in Bricolage Grotesque and numbers in Spline Sans Mono, with tabular figures and a real minus sign so columns line up. There's one accent colour, Sulfur (`#DCEC3A`), on a Chalk ground (`#FAFAF9`), and tables use hairline rules instead of cards.

## Known issues

- A few repos are listed twice, under an old name and the current one (react/react and facebook/react). The listings page hides the duplicate. The proper fix is keying listings on GitHub's node id.
- Owners can still nudge their own repo's price by opening PRs or issues on it. Log scaling keeps that to a few dollars, which matters most on small repos.
- Calls use even money. The target floor comes from recent growth, so a repo that suddenly takes off can still beat it.
- The hourly jobs run on GitHub Actions cron, which sometimes starts late.
- Listing pages need an account, so search engines can't see them.

## Next

- Odds for calls, priced from each repo's star history instead of a flat even money. The worker records that history now.
- Listing pages you can read without an account.

## Tests

```
cd ledger && npm test               # call rules, plus the fixtures in the Node and TypeScript pricers (Node 24)
python3 data-engine/test_pricing.py # the fixtures in the Python pricer
```

## License

[AGPL-3.0](LICENSE)
