-- adds github_node_id, github's global id for a repo, which survives renames and
-- redirects where the ticker string doesn't. it gives duplicate listings of the same
-- repo under different tickers (react/react and facebook/react) a stable key to
-- collapse on. nullable, with a partial index on the rows that have one.
-- safe to run more than once.

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS github_node_id TEXT;

CREATE INDEX IF NOT EXISTS idx_repositories_github_node_id
  ON repositories (github_node_id)
  WHERE github_node_id IS NOT NULL;
