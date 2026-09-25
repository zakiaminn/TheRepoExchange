-- adds the two timestamps needed to reproduce a stored price exactly. the price is
-- (gross - debt) * recency, and recency depends on how long before pricing the repo
-- was last pushed to:
--
--   pushed_at  the repo's last push time from github
--   priced_at  when the worker or ledger last computed current_price
--
-- with both, the asset page can rebuild the price line by line. both are nullable,
-- and existing rows stay null until the worker's next pass fills them in.
-- safe to run more than once.

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priced_at TIMESTAMPTZ;
