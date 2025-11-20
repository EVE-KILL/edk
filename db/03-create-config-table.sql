-- Configuration table - Tracks import state, build numbers, and metadata
USE edk;
CREATE TABLE IF NOT EXISTS config (
  configKey String NOT NULL,
  configValue String,
  buildNumber Nullable(UInt32),
  tableName Nullable(String),
  rowCount Nullable(UInt32),
  updatedAt DateTime,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY (configKey, version);
