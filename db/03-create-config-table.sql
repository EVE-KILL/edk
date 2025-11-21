-- Configuration table - Tracks import state, build numbers, and metadata
CREATE TABLE IF NOT EXISTS config (
  "configKey" TEXT PRIMARY KEY,
  "configValue" TEXT,
  "buildNumber" INTEGER,
  "tableName" TEXT,
  "rowCount" INTEGER,
  "updatedAt" TIMESTAMP,
  "version" BIGINT
);
