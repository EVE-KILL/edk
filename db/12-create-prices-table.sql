USE edk;

-- ============================================================================
-- PRICES TABLE
-- ============================================================================

-- Prices table - Stores historical price data
CREATE TABLE IF NOT EXISTS prices (
  typeId UInt32 NOT NULL,
  regionId UInt32 NOT NULL,
  priceDate Date NOT NULL,
  averagePrice Float64,
  highestPrice Float64,
  lowestPrice Float64,
  orderCount UInt32,
  volume UInt32,
  updatedAt DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_type (typeId) TYPE minmax GRANULARITY 3,
  INDEX idx_region (regionId) TYPE minmax GRANULARITY 3,
  INDEX idx_date (priceDate) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY (typeId, regionId, priceDate)
PARTITION BY toYYYYMM(priceDate);
