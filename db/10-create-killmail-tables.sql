-- ============================================================================
-- CORE KILLMAIL TABLES (OPTIMIZED)
-- ============================================================================

-- Killmails table - Core killmail records with victim information
CREATE TABLE IF NOT EXISTS killmails (
  killmailId INTEGER PRIMARY KEY,
  killmailTime TIMESTAMP NOT NULL,
  solarSystemId INTEGER NOT NULL,

  -- Victim information
  victimAllianceId INTEGER,
  victimCharacterId INTEGER,
  victimCorporationId INTEGER,
  victimDamageTaken INTEGER,
  victimShipTypeId INTEGER,

  -- Victim position
  positionX DOUBLE PRECISION,
  positionY DOUBLE PRECISION,
  positionZ DOUBLE PRECISION,

  -- ESI hash for API access
  hash TEXT DEFAULT '',

  -- Denormalized attacker info (top/final blow attacker)
  topAttackerCharacterId INTEGER,
  topAttackerCorporationId INTEGER,
  topAttackerAllianceId INTEGER,
  topAttackerShipTypeId INTEGER,

  -- Aggregate stats
  totalValue DOUBLE PRECISION DEFAULT 0,
  attackerCount INTEGER DEFAULT 0,

  -- Flags
  npc BOOLEAN DEFAULT false,
  solo BOOLEAN DEFAULT false,
  awox BOOLEAN DEFAULT false,

  createdAt TIMESTAMP DEFAULT NOW(),
  version BIGINT
);

CREATE INDEX IF NOT EXISTS idx_killmails_solar_system ON killmails (solarSystemId);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_character ON killmails (victimCharacterId);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_corporation ON killmails (victimCorporationId);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_alliance ON killmails (victimAllianceId);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_ship_type ON killmails (victimShipTypeId);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_damage_taken ON killmails (victimDamageTaken);
CREATE INDEX IF NOT EXISTS idx_killmails_total_value ON killmails (totalValue);
CREATE INDEX IF NOT EXISTS idx_killmails_time ON killmails (killmailTime);


-- Attackers table
CREATE TABLE IF NOT EXISTS attackers (
  id SERIAL PRIMARY KEY,
  killmailId INTEGER NOT NULL,
  killmailTime TIMESTAMP NOT NULL,
  allianceId INTEGER,
  corporationId INTEGER,
  characterId INTEGER,
  damageDone INTEGER,
  finalBlow BOOLEAN,
  securityStatus REAL,
  shipTypeId INTEGER,
  weaponTypeId INTEGER,
  createdAt TIMESTAMP DEFAULT NOW(),
  version BIGINT
);

CREATE INDEX IF NOT EXISTS idx_attackers_killmail_id ON attackers (killmailId);
CREATE INDEX IF NOT EXISTS idx_attackers_character ON attackers (characterId);
CREATE INDEX IF NOT EXISTS idx_attackers_corporation ON attackers (corporationId);
CREATE INDEX IF NOT EXISTS idx_attackers_alliance ON attackers (allianceId);
CREATE INDEX IF NOT EXISTS idx_attackers_ship_type ON attackers (shipTypeId);
CREATE INDEX IF NOT EXISTS idx_attackers_weapon_type ON attackers (weaponTypeId);
CREATE INDEX IF NOT EXISTS idx_attackers_final_blow ON attackers (finalBlow);
CREATE INDEX IF NOT EXISTS idx_attackers_time ON attackers (killmailTime);


-- Items table
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  killmailId INTEGER NOT NULL,
  killmailTime TIMESTAMP NOT NULL,
  flag INTEGER,
  itemTypeId INTEGER,
  quantityDropped INTEGER,
  quantityDestroyed INTEGER,
  singleton BOOLEAN,
  createdAt TIMESTAMP DEFAULT NOW(),
  version BIGINT
);

CREATE INDEX IF NOT EXISTS idx_items_killmail_id ON items (killmailId);
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items (itemTypeId);
CREATE INDEX IF NOT EXISTS idx_items_flag ON items (flag);
CREATE INDEX IF NOT EXISTS idx_items_time ON items (killmailTime);
