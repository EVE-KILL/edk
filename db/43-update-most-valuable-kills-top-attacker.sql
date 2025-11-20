USE edk;

-- Add skip index on entityType to accelerate killlist filters
ALTER TABLE killlist
    ADD INDEX IF NOT EXISTS idx_killlist_entity_type (entityType) TYPE set(100) GRANULARITY 3;

-- Ensure the new index is materialized for historical parts
ALTER TABLE killlist MATERIALIZE INDEX idx_killlist_entity_type;

-- Add projection optimized for entity filters and materialize it
ALTER TABLE killlist
    ADD PROJECTION IF NOT EXISTS killlist_by_entity_type
        (SELECT * ORDER BY (entityType, entityId, killmailTime, killmailId));

ALTER TABLE killlist MATERIALIZE PROJECTION killlist_by_entity_type;
