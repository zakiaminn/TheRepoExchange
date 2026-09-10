-- Repo Calls: a user's prediction that a repository reaches a star target by a
-- deadline. Settled even-money from the simulated wallet by the ledger's resolver
-- (see ledger/calls.js): a correct call returns 2x the stake, a wrong one forfeits
-- it, a voided one refunds it. Every outcome is judged against the public star count,
-- so it stays as verifiable as the prices.
--
-- APPLY ORDER (each step is safe on its own):
--   1. Run this migration. Creates the table, its indexes, and RLS. No effect on the
--      existing board, portfolios, or wallet.
--   2. Deploy the ledger (ledger/server.js): adds POST /api/calls (open),
--      GET /api/calls (list), POST /api/calls/settle (resolver). Deploy only AFTER
--      step 1 — the routes read/write this table.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS calls (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    ticker         text NOT NULL,
    direction      text NOT NULL DEFAULT 'above' CHECK (direction IN ('above', 'below')),
    target_stars   bigint NOT NULL CHECK (target_stars > 0),
    stake          numeric(15, 2) NOT NULL CHECK (stake > 0),
    deadline       timestamptz NOT NULL,
    status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'void')),
    opening_stars  bigint,                 -- star count when the call was opened (context)
    created_at     timestamptz NOT NULL DEFAULT now(),
    resolved_at    timestamptz,            -- when the resolver settled it
    resolved_stars bigint,                 -- the public star count it was judged against
    payout         numeric(15, 2)          -- credited to the wallet on settle (0 on a loss)
);

-- a user's own calls, newest first (the "your calls" list)
CREATE INDEX IF NOT EXISTS idx_calls_user ON calls (user_id, created_at DESC);
-- the resolver's working set: open calls whose deadline has passed
CREATE INDEX IF NOT EXISTS idx_calls_due ON calls (deadline) WHERE status = 'open';

-- Defense in depth: even though writes and settlement go through the ledger's
-- service-role connection (which bypasses RLS), lock the table down so a viewer using
-- the Supabase client directly can only ever read their OWN calls — same posture as
-- portfolios and transactions.
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_select_own ON calls;
CREATE POLICY calls_select_own ON calls
    FOR SELECT
    USING (auth.uid() = user_id);
