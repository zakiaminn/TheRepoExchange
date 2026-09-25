-- adds the raw github metrics the pricing formula uses, so the app can show why a repo
-- is priced what it is and not just the final number.
-- safe to run more than once. existing rows default to 0 until the worker refreshes them.
ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS raw_forks       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_watchers    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_open_issues INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_open_prs    INTEGER DEFAULT 0;
