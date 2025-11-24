-- Enable the pg_trgm extension for trigram-based similarity search
-- This allows for fuzzy matching and typo tolerance
CREATE EXTENSION IF NOT EXISTS pg_trgm;
