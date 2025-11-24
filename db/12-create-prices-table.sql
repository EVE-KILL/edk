-- ============================================================================
-- PRICES TABLE (PARTITIONED BY YEAR)
-- ============================================================================

-- Prices table - Stores historical price data
-- Partitioned by RANGE on priceDate (yearly partitions)
CREATE TABLE IF NOT EXISTS prices (
  "typeId" INTEGER NOT NULL,
  "regionId" INTEGER NOT NULL,
  "priceDate" DATE NOT NULL,
  "averagePrice" REAL,
  "highestPrice" REAL,
  "lowestPrice" REAL,
  "orderCount" SMALLINT,
  "volume" BIGINT,
  PRIMARY KEY ("typeId", "regionId", "priceDate")
) PARTITION BY RANGE ("priceDate");

-- Create indexes on parent table (will be inherited by partitions)
CREATE INDEX IF NOT EXISTS "idx_prices_type" ON prices ("typeId");
CREATE INDEX IF NOT EXISTS "idx_prices_region" ON prices ("regionId");
CREATE INDEX IF NOT EXISTS "idx_prices_date" ON prices ("priceDate");

-- Partial index for high-volume regional price lookups
CREATE INDEX IF NOT EXISTS "idx_prices_region_type_date_volume"
  ON prices ("regionId", "typeId", "priceDate" DESC)
  WHERE "volume" > 100;
