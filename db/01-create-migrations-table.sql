-- Migration tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE
);
