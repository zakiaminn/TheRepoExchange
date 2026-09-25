-- pricing versions, star history, per-user listings, money constraints, and table grants.
-- safe to run more than once.

-- which formula produced each price, so charts only draw prices from the current one
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS pricing_version text;
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS pricing_version text;

-- the star count at each pricing pass. calls are opened and settled against these readings
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS stars integer;

-- where a listing came from. 'worker' rows come from the worker's category searches and show
-- on the shared board. 'user' rows were added from the app and only show for the people who
-- added them (user_listings)
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'worker';
ALTER TABLE repositories DROP CONSTRAINT IF EXISTS repositories_source_check;
ALTER TABLE repositories ADD CONSTRAINT repositories_source_check CHECK (source IN ('worker', 'user'));

-- rows added through the app were filed under their github language instead of a worker category
UPDATE repositories SET source = 'user'
WHERE source = 'worker'
  AND (category IS NULL OR category NOT IN (
    'AI & Machine Learning', 'Blue Chip Systems', 'Web Frameworks', 'Hot IPOs (Last 30 Days)'
  ));

CREATE TABLE IF NOT EXISTS user_listings (
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    ticker     text NOT NULL REFERENCES repositories (ticker) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ticker)
);
ALTER TABLE user_listings ENABLE ROW LEVEL SECURITY;

-- anyone already holding or calling a user-added repo keeps it on their own board
INSERT INTO user_listings (user_id, ticker)
SELECT DISTINCT p.user_id, r.ticker
FROM portfolios p JOIN repositories r ON r.ticker = p.ticker
WHERE r.source = 'user' AND p.user_id IS NOT NULL AND p.shares > 0
ON CONFLICT DO NOTHING;

INSERT INTO user_listings (user_id, ticker)
SELECT DISTINCT c.user_id, r.ticker
FROM calls c JOIN repositories r ON r.ticker = c.ticker
WHERE r.source = 'user'
ON CONFLICT DO NOTHING;

-- ticker lookups are case-insensitive, this keeps them on an index
CREATE INDEX IF NOT EXISTS idx_repositories_ticker_lower ON repositories (lower(ticker));

-- balances and holdings can't go negative or null
UPDATE users SET cash_balance = 100000.00 WHERE cash_balance IS NULL;
ALTER TABLE users ALTER COLUMN cash_balance SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_cash_nonnegative;
ALTER TABLE users ADD CONSTRAINT users_cash_nonnegative CHECK (cash_balance >= 0);
ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS portfolios_shares_nonnegative;
ALTER TABLE portfolios ADD CONSTRAINT portfolios_shares_nonnegative CHECK (shares >= 0);

-- the ledger and the worker connect as postgres and don't need these grants. the browser
-- only ever reads its own calls, which rls already limits to the signed-in user
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON public.calls TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- the signup trigger only uses schema-qualified names, so it can run with an empty search_path
ALTER FUNCTION public.handle_new_user() SET search_path = '';
