-- ============================================================================
-- PRICES TABLE
-- ============================================================================

-- Prices table - Stores historical price data
CREATE TABLE IF NOT EXISTS prices (
  "typeId" INTEGER NOT NULL,
  "regionId" INTEGER NOT NULL,
  "priceDate" DATE NOT NULL,
  "averagePrice" DOUBLE PRECISION,
  "highestPrice" DOUBLE PRECISION,
  "lowestPrice" DOUBLE PRECISION,
  "orderCount" INTEGER,
  "volume" BIGINT,
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "version" BIGINT,
  PRIMARY KEY ("typeId", "regionId", "priceDate")
);

CREATE INDEX IF NOT EXISTS "idx_prices_type" ON prices ("typeId");
CREATE INDEX IF NOT EXISTS "idx_prices_region" ON "prices" ("regionId");
CREATE INDEX IF NOT EXISTS "idx_prices_date" ON "prices" ("priceDate");
