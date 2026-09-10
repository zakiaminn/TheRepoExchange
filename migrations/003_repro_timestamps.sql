-- Persist the two timestamps a stored mark needs to be reproduced EXACTLY.
--
-- The price is (gross - debt) * recency, and recency is a function of how long
-- ago the repo was pushed to. Without the push time we cannot show or check the
-- recency term at all; without the time the price was struck we cannot pin
-- recency to the moment it was computed (wall-clock keeps moving, so a recompute
-- at read time uses a larger "days" than the mark did). These two columns close
-- both gaps, so an asset page can reconstruct the mark line by line instead of
-- backing the recency factor out of the number.
--
--   pushed_at  - the repo's last-push time from GitHub (recency INPUT).
--   priced_at  - when the worker/ledger last struck current_price (recency ANCHOR:
--                the mark's recency was computed from priced_at - pushed_at).
--
-- Both nullable: existing rows carry NULL until the worker's next pass fills them,
-- and the asset page falls back to an implied recency factor while they are NULL.
--
-- APPLY ORDER (each step is safe on its own):
--   1. Run this migration. Adds two nullable columns. No backfill, no data change,
--      nothing breaks if the worker/ledger still write the old shape.
--   2. Deploy the worker (data-engine/worker.py) and ledger (ledger/server.js):
--      both now write pushed_at + priced_at on every price they strike, and the
--      ledger returns both on the asset payload. Deploy only AFTER step 1 — they
--      write columns that must already exist.
--
-- Safe to run more than once.

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priced_at TIMESTAMPTZ;
