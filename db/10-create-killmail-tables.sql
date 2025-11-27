-- ============================================================================
-- CORE KILLMAIL TABLES (OPTIMIZED WITH PARTITIONING & DENORMALIZATION)
-- ============================================================================
-- Tables are partitioned by year-month based on killmailTime to handle
-- 90M+ killmails, 720M+ attackers, and 1B+ items efficiently.
--
-- Storage optimizations applied:
--  • SMALLINT for small numbers (attackerCount, flag, orderCount, etc.)
--  • REAL for floating point (prices, positions, security)
--  • INTEGER for most IDs
--  • Denormalized fields to avoid JOINs (regionId, shipGroupId, securityStatus)
-- ============================================================================

-- Suppress NOTICE messages for cleaner output
SET client_min_messages TO WARNING;

-- Killmails table - Core killmail records with victim information
-- Partitioned by RANGE on killmailTime (monthly partitions)
CREATE TABLE IF NOT EXISTS killmails (
  "killmailId" BIGINT NOT NULL,
  "killmailTime" TIMESTAMPTZ NOT NULL,
  "solarSystemId" INTEGER NOT NULL,

  -- Victim information
  "victimAllianceId" BIGINT,
  "victimCharacterId" BIGINT,
  "victimCorporationId" BIGINT,
  "victimDamageTaken" INTEGER,
  "victimShipTypeId" INTEGER,

  -- Victim position (REAL for storage efficiency)
  "positionX" REAL,
  "positionY" REAL,
  "positionZ" REAL,

  -- ESI hash for API access
  "hash" VARCHAR(40) DEFAULT '',

  -- Denormalized attacker info (top/final blow attacker)
  "topAttackerCharacterId" BIGINT,
  "topAttackerCorporationId" BIGINT,
  "topAttackerAllianceId" BIGINT,
  "topAttackerShipTypeId" INTEGER,

  -- Aggregate stats (REAL for ISK value, SMALLINT for counts)
  "totalValue" REAL DEFAULT 0,
  "attackerCount" SMALLINT DEFAULT 0,

  -- Flags
  "npc" BOOLEAN DEFAULT false,
  "solo" BOOLEAN DEFAULT false,
  "awox" BOOLEAN DEFAULT false,

  -- Denormalized location IDs for faster queries (avoids joins)
  "regionId" INTEGER,
  "constellationId" INTEGER,
  "securityStatus" REAL,

  -- Denormalized ship groups for faster filtering (avoids type→group joins)
  "victimShipGroupId" INTEGER,
  "topAttackerShipGroupId" INTEGER,

  PRIMARY KEY ("killmailId", "killmailTime")
) PARTITION BY RANGE ("killmailTime");

-- Create indexes on the parent table (will be inherited by partitions)
-- Note: Composite indexes can serve queries on just the first column
-- Location indexes (added by migration 51)
CREATE INDEX IF NOT EXISTS idx_killmails_region_time ON killmails ("regionId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_constellation_time ON killmails ("constellationId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_system_time ON killmails ("solarSystemId", "killmailTime" DESC);

-- Victim indexes (composite only, single-column indexes are redundant)
CREATE INDEX IF NOT EXISTS idx_killmails_victim_char_time ON killmails ("victimCharacterId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_corp_time ON killmails ("victimCorporationId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_ally_time ON killmails ("victimAllianceId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_ship_type_time ON killmails ("victimShipTypeId", "killmailTime" DESC);

-- Attacker indexes
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_char ON killmails ("topAttackerCharacterId");
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_corp ON killmails ("topAttackerCorporationId");
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_ally ON killmails ("topAttackerAllianceId");

-- Value and flag indexes
CREATE INDEX IF NOT EXISTS idx_killmails_value_time ON killmails ("totalValue", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_npc_time ON killmails (npc, "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_solo_time ON killmails (solo, "killmailTime" DESC);

-- Security and ship group indexes (for space type and ship class filtering)
CREATE INDEX IF NOT EXISTS idx_killmails_security_time ON killmails ("securityStatus", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_ship_group_time ON killmails ("victimShipGroupId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_attacker_ship_group_time ON killmails ("topAttackerShipGroupId", "killmailTime" DESC);

-- Complex composite for top stats
CREATE INDEX IF NOT EXISTS idx_killmails_time_attackers ON killmails ("killmailTime" DESC, "topAttackerCharacterId", "topAttackerCorporationId", "topAttackerAllianceId");


-- Attackers table - Partitioned by RANGE on killmailTime (monthly partitions)
CREATE TABLE IF NOT EXISTS attackers (
  "id" BIGSERIAL NOT NULL,
  "killmailId" BIGINT NOT NULL,
  "killmailTime" TIMESTAMPTZ NOT NULL,
  "allianceId" BIGINT,
  "corporationId" BIGINT,
  "characterId" BIGINT,
  "damageDone" INTEGER,
  "finalBlow" BOOLEAN,
  "securityStatus" REAL,
  "shipTypeId" INTEGER,
  "weaponTypeId" INTEGER,

  PRIMARY KEY ("id", "killmailTime")
) PARTITION BY RANGE ("killmailTime");

CREATE INDEX IF NOT EXISTS "idx_attackers_killmail_id" ON attackers ("killmailId");
CREATE INDEX IF NOT EXISTS "idx_attackers_character" ON attackers ("characterId");
CREATE INDEX IF NOT EXISTS "idx_attackers_corporation" ON attackers ("corporationId");
CREATE INDEX IF NOT EXISTS "idx_attackers_alliance" ON attackers ("allianceId");
CREATE INDEX IF NOT EXISTS "idx_attackers_ship_type" ON attackers ("shipTypeId");
CREATE INDEX IF NOT EXISTS "idx_attackers_weapon_type" ON attackers ("weaponTypeId");
CREATE INDEX IF NOT EXISTS "idx_attackers_final_blow" ON attackers ("finalBlow");
CREATE INDEX IF NOT EXISTS "idx_attackers_time" ON attackers ("killmailTime");


-- Items table - Partitioned by RANGE on killmailTime (monthly partitions)
-- Note: singleton is SMALLINT (0/1/2) not BOOLEAN due to EVE API format
CREATE TABLE IF NOT EXISTS items (
  "id" BIGSERIAL NOT NULL,
  "killmailId" BIGINT NOT NULL,
  "killmailTime" TIMESTAMPTZ NOT NULL,
  "flag" SMALLINT,
  "itemTypeId" INTEGER,
  "quantityDropped" INTEGER,
  "quantityDestroyed" INTEGER,
  "singleton" SMALLINT,

  PRIMARY KEY ("id", "killmailTime")
) PARTITION BY RANGE ("killmailTime");

CREATE INDEX IF NOT EXISTS "idx_items_killmail_id" ON items ("killmailId");
CREATE INDEX IF NOT EXISTS "idx_items_item_type" ON items ("itemTypeId");
CREATE INDEX IF NOT EXISTS "idx_items_flag" ON items ("flag");
CREATE INDEX IF NOT EXISTS "idx_items_time" ON items ("killmailTime");
CREATE INDEX IF NOT EXISTS "idx_items_killmail_type" ON items ("killmailId", "itemTypeId") WHERE "itemTypeId" IS NOT NULL;

-- Add faction IDs for faction warfare tracking
ALTER TABLE killmails ADD COLUMN IF NOT EXISTS "victimFactionId" INTEGER;
ALTER TABLE killmails ADD COLUMN IF NOT EXISTS "topAttackerFactionId" INTEGER;
ALTER TABLE killmails ADD COLUMN IF NOT EXISTS "moonId" INTEGER;

-- Add faction ID to attackers table
ALTER TABLE attackers ADD COLUMN IF NOT EXISTS "factionId" INTEGER;

-- Create indexes for faction filtering
CREATE INDEX IF NOT EXISTS idx_killmails_victim_faction_time ON killmails ("victimFactionId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_faction ON killmails ("topAttackerFactionId");
CREATE INDEX IF NOT EXISTS idx_killmails_moon ON killmails ("moonId");
CREATE INDEX IF NOT EXISTS idx_attackers_faction ON attackers ("factionId");

-- Restore normal message level
SET client_min_messages TO NOTICE;
