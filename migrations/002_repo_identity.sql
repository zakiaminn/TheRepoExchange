-- Durable identity for a listing, so duplicate admissions of the same repository
-- under different tickers (react/react vs facebook/react; ECC vs
-- everything-claude-code) collapse on a STABLE key rather than the ticker string.
-- GitHub's node_id is global and survives renames and redirects, which the ticker
-- does not. This is the durable half of the dedupe; the read-side half already
-- ships in ledger/server.js (/api/discovery), keyed on the metric fingerprint
-- until node_id is populated.
--
-- APPLY ORDER (each step is safe on its own; the board stays deduped throughout):
--   1. Run this migration. Adds a nullable column + partial index. No backfill,
--      no data change, nothing breaks if the worker still writes the old shape.
--
--   2. Deploy the worker change (data-engine/worker.py). Capture repo["node_id"]
--      from the GitHub single-repo response and write it in BOTH paths:
--        - UPDATE-known:  UPDATE repositories SET github_node_id = %s, ... WHERE ticker = %s
--        - INSERT-new:    INSERT INTO repositories (..., github_node_id) VALUES (..., %s)
--      GET /repos/{owner}/{repo} returns the CANONICAL repo's node_id even when
--      called with an alias, so both duplicate rows fill with the same node_id on
--      the next poll cycle. (Deploy this only AFTER step 1 — the worker will try
--      to write a column that must already exist.)
--
--   3. In ledger/server.js discovery, add `github_node_id` to the SELECT. The
--      identity() helper there already reads `r.github_node_id ?? <fingerprint>`,
--      so this one word upgrades the key to the node id with no other change.
--
--   4. Optional cleanup once node_ids are populated — retire all but the canonical
--      row per repo instead of relying on read-side dedupe:
--        UPDATE repositories r SET is_active = FALSE
--        WHERE r.github_node_id IS NOT NULL
--          AND r.ctid <> (
--            SELECT r2.ctid FROM repositories r2
--            WHERE r2.github_node_id = r.github_node_id AND r2.is_active
--            ORDER BY (lower(split_part(r2.ticker,'/',1)) <> lower(split_part(r2.ticker,'/',2))) DESC,
--                     r2.raw_stars DESC
--            LIMIT 1
--          );
--      (Keeps the non-self-named alias — facebook/react over react/react — then
--      the higher star count, matching the read-side tiebreak.)
--
-- Separately, the developer-roadmap-under-nilbuild MISATTRIBUTION is not a
-- duplicate (one row, wrong owner) and is not addressed here: correct that row's
-- ticker/owner directly once verified against the real repository.
--
-- Safe to run more than once.

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS github_node_id TEXT;

CREATE INDEX IF NOT EXISTS idx_repositories_github_node_id
  ON repositories (github_node_id)
  WHERE github_node_id IS NOT NULL;
