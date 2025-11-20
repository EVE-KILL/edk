-- Migration tracking table
USE edk;
CREATE TABLE IF NOT EXISTS migrations (
  id UInt32,
  filename String NOT NULL,
  checksum String NOT NULL,
  applied_at DateTime DEFAULT now(),
  success UInt8 DEFAULT 1
) ENGINE = MergeTree()
ORDER BY (applied_at, id);
