# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: engineers evaluating the builder.** Senior engineers, hiring managers, and technically literate reviewers who arrive from a link or a portfolio and are deciding, within a minute or two, whether the person who made this can build real systems. They read the architecture before they read the copy. They will check the arithmetic.

**Secondary: developers who might actually play.** Working developers who find it through a colleague, recognise the repositories on the board, and want to buy shares in a project they have opinions about. They arrive cold, with no context and no patience for onboarding.

Where the two conflict, the engineering story wins — but a compromise visible to either audience is a failure. The product must genuinely work, not merely appear to.

## Product Purpose

A simulated exchange where GitHub repositories are traded as securities. Users open an account, receive fictional capital, and buy and sell positions in real repositories whose prices track live GitHub activity.

Success is a reviewer concluding, from the artifact alone, that this was built by someone who understands distributed systems, rate limits, data integrity, and interface craft — while a developer who just wants to buy shares in `oven-sh/bun` can do so without reading anything first.

## Positioning

Prices are not quoted, invented, or driven by a hidden signal: each mark is a fixed, published function of a handful of public GitHub metrics for the repository (stars, forks, watchers, open PRs, open issues, last push). The formula is published in full — see `METHODOLOGY.md` — so anyone can reproduce any price on the board from the repository's public numbers. No neighbouring "fantasy stock market" toy derives its prices from public, independently auditable inputs by a stated formula.

## Operating Context

- Reviewers arrive from a portfolio link, a README, or a shared URL, usually on desktop, often with a second tab open comparing candidates.
- Developers arrive from a colleague's link, frequently on a phone, with no prior explanation.
- Evaluation happens in minutes, not sessions. Nobody reads documentation first.
- The board's credibility is checked against GitHub itself, in another tab, within seconds of arrival.

## Capabilities and Constraints

**Locked product facts.** Future work must not quietly change these:

- **Published, reproducible pricing.** Price is a fixed, published function of six public GitHub metrics (see `METHODOLOGY.md`), reproducible by anyone from the repository's public numbers — not a quote off a wire, not a hidden model. The formula is versioned; a mark is only reproducible against the version it was struck under. Consequence to design around, not away from: the dominant term (stars) moves roughly 0.01% per day, so any change metric measured over a short window is effectively zero. A change column must state the period it measures or not exist. (This supersedes the earlier "one star, one cent / fixed 1:100 ratio" fact, which the implementation never matched; the change is deliberate, not quiet.)
- **Simulated only, permanently.** $100,000 fictional opening capital, credited once, non-transferable. No deposits, no withdrawals, no real money — not a stage the product grows out of.
- **Continuous session, no close.** No market open, close, or daily settlement print. Prices update by polling. There is no opening gap and no end-of-day moment to design toward.

**Currently true, not locked:**

- Long-only. Buy to open, sell to close. Shorting is deliberately left as an open product decision rather than a closed door.
- Market orders only, with slippage checked at the ledger and rejected rather than absorbed.
- 85 listings, grouped by category from the discovery endpoint.

**Known data-integrity defect (open):** the listings set contains duplicate entries for the same repository under different tickers (`facebook/react` and `react/react` at identical prices; `affaan-m/everything-claude-code` and `affaan-m/ECC`) and at least one misattribution (`developer-roadmap` under owner `nilbuild`). Because the entire positioning rests on verifiability, this is a product defect, not a cosmetic one. Deduplication must key on the resolved GitHub node id, not the ticker string.

## Brand Commitments

- **Name: TRX / "The Repo Exchange."** Binding.
- **Domain: therepo.exchange.** Binding.
- Everything else — palette, typography, wordmark and seal, composition, and register — is explicitly open for replacement.

**Confirmed voice constraint:** the deadpan institutional register previously adopted was judged to have overshot into costume. The product is not to be presented as a joke. Plain, exact, unsentimental language; period-exchange vocabulary is out.

## Evidence on Hand

- **Real, live data.** 85 listings served from the ledger with real GitHub metrics and prices derived from them by the published formula (`METHODOLOGY.md`). Every listing's asset page shows the full derivation, line by line, so the mark reconciles to the public inputs.
- **Working system.** Express ledger with IP rate limiting and an in-memory cache; Python worker polling the GitHub API with exponential backoff and historical backfill; Supabase auth with Postgres row-level security.
- **Real price history** per listing, sufficient to draw a chart, backfilled where GitHub history allows.
- **Do not fabricate:** user counts, trading volume, testimonials, press, uptime figures, or any claim about people using this. None exist.

## Product Principles

1. **Verifiability is the product.** Every price must be reproducible from public GitHub inputs and the published formula (`METHODOLOGY.md`). Anything that makes the data look invented — an unpublished term in the mark, duplicates, misattribution, a change column reading `−0.00%` beside a plunging chart — attacks the core claim.
2. **The system is the pitch.** The primary audience reads architecture. Depth, correctness, and craft outrank persuasion techniques.
3. **Legible cold.** A developer arriving from a link with no context must understand what this is and be able to act, without documentation.
4. **Plain, not performed.** Exact and unsentimental. The honesty is the character; the costume was not.
5. **Never overclaim.** The product is a simulation and says so plainly. No invented traction, no implied stakes.

## Accessibility & Inclusion

WCAG 2.1 AA is the working standard — the existing token system already reasons explicitly about text contrast ratios, and the primary audience is professionally equipped to notice failures. Non-text contrast (1.4.11) on control boundaries is currently failing and is a known open defect.
