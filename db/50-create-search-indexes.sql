-- Add GIN indexes for full-text search on entity names
-- These indexes use PostgreSQL's built-text search capabilities
-- Note: Some indexes may already exist from previous migrations

-- Solar Systems (missing from previous migrations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solarsystems_name_gin ON solarsystems USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solarsystems_name_trgm ON solarsystems USING gin(name gin_trgm_ops);

-- Constellations (missing from previous migrations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_constellations_name_gin ON constellations USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_constellations_name_trgm ON constellations USING gin(name gin_trgm_ops);

-- Regions (missing from previous migrations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regions_name_gin ON regions USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regions_name_trgm ON regions USING gin(name gin_trgm_ops);

-- Entity name search indexes (functional indexes for LOWER(name))
-- Characters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_name_lower ON characters (LOWER(name) text_pattern_ops);

-- Corporations  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corporations_name_lower ON corporations (LOWER(name) text_pattern_ops);

-- Alliances
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alliances_name_lower ON alliances (LOWER(name) text_pattern_ops);

-- Types (items/ships)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_types_name_lower_published ON types (LOWER(name) text_pattern_ops) WHERE "published" = true;

-- Solar Systems (add text_pattern_ops for LIKE optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solarsystems_name_lower ON solarsystems (LOWER(name) text_pattern_ops);

-- Constellations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_constellations_name_lower ON constellations (LOWER(name) text_pattern_ops);

-- Regions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regions_name_lower ON regions (LOWER(name) text_pattern_ops);
