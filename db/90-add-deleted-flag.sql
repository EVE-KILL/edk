-- ============================================================================
-- ADD DELETED FLAG TO CHARACTER TABLE
-- ============================================================================
-- Characters can be biomassed/deleted in EVE Online
-- Corporations and alliances cannot be deleted (they just close/disband but persist)
-- Track deleted characters to avoid repeatedly querying ESI for them

ALTER TABLE characters ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add index for efficient filtering of non-deleted characters
CREATE INDEX IF NOT EXISTS "idx_characters_deleted" ON characters (deleted) WHERE deleted = FALSE;
