-- the per-listing price change at each formula switch, which older prices and entry prices
-- were scaled by (see data-engine/backfill.py). ratio = new_price / old_price.
-- safe to run more than once.

CREATE TABLE IF NOT EXISTS price_adjustments (
    ticker      text NOT NULL,
    switched_at timestamptz NOT NULL,
    to_version  text NOT NULL,
    old_price   numeric(15, 2) NOT NULL,
    new_price   numeric(15, 2) NOT NULL,
    ratio       numeric(18, 8) NOT NULL,
    PRIMARY KEY (ticker, switched_at)
);

ALTER TABLE price_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON price_adjustments FROM anon, authenticated;
