-- the calls table. a call is a user's prediction that a repo reaches a star target by a
-- deadline. the ledger settles it even-money from the wallet against the public star
-- count: a correct call returns 2x the stake, a wrong one loses it, a voided one refunds it.
-- safe to run more than once.

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

-- writes and settlement go through the ledger's service-role connection, which bypasses
-- rls. with rls on, anyone using the supabase client directly can only read their own
-- calls, same as portfolios and transactions
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_select_own ON calls;
CREATE POLICY calls_select_own ON calls
    FOR SELECT
    USING (auth.uid() = user_id);
