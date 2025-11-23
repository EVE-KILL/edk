-- Configuration table - Tracks import state, build numbers, and metadata
CREATE TABLE IF NOT EXISTS config (
  "configKey" VARCHAR(255) PRIMARY KEY,
  "configValue" VARCHAR(255),
  "buildNumber" INTEGER,
  "tableName" VARCHAR(255),
  "rowCount" INTEGER,
  "updatedAt" TIMESTAMP
);
