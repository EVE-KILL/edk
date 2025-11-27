-- Custom Prices Table
-- Used for hardcoded prices for rare/special items, market manipulated items, and AT ships

CREATE TABLE IF NOT EXISTS customprices (
  "typeId" INTEGER PRIMARY KEY,
  "customPrice" BIGINT NOT NULL,
  "reason" VARCHAR(255),
  "validFrom" DATE,
  "validUntil" DATE,
  "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_customprices_validFrom" ON customprices ("validFrom");
CREATE INDEX IF NOT EXISTS "idx_customprices_validUntil" ON customprices ("validUntil");

-- Seed data from zKillboard's known prices
-- Source: https://github.com/zKillboard/zKillboard/blob/master/classes/Price.php

-- Market Manipulated Items (set to 0.01 to prevent abuse)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (12478, 1, 'market_manipulation', 'Khumaak - market manipulated'),
  (34559, 1, 'market_manipulation', 'Conflux Element - market manipulated'),
  (44265, 1, 'market_manipulation', 'Victory Firework - drops from sites'),
  (34558, 1, 'market_manipulation', 'Market manipulated'),
  (34556, 1, 'market_manipulation', 'Market manipulated'),
  (34560, 1, 'market_manipulation', 'Market manipulated'),
  (36902, 1, 'market_manipulation', 'Market manipulated'),
  (34557, 1, 'market_manipulation', 'Market manipulated'),
  (44264, 1, 'market_manipulation', 'Market manipulated'),
  (55511, 30000000, 'market_manipulation', 'Obnoxiously market manipulated - hardcoded price')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "reason" = EXCLUDED."reason",
  "notes" = EXCLUDED."notes";

-- Limited Time Prices (with date ranges)
INSERT INTO customprices ("typeId", "customPrice", "reason", "validFrom", "validUntil", "notes") VALUES
  (88001, 10000000000, 'limited_time', NULL, '2025-06-01', 'Temporary price until June 2025')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "validUntil" = EXCLUDED."validUntil";

-- Faction Logistics Frigates
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (45645, 35000000000, 'rare_ship', 'Loggerhead - 35B'),
  (87381, 45000000000, 'rare_ship', 'Sarathiel - 45B'),
  (42124, 45000000000, 'rare_ship', '45B'),
  (42243, 70000000000, 'rare_ship', 'Chemosh - 70B')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Alliance Tournament Frigates (80B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (2834, 80000000000, 'at_ship', 'Utu - AT Prize Frigate'),
  (3516, 80000000000, 'at_ship', 'Malice - AT Prize Frigate'),
  (11375, 80000000000, 'at_ship', 'Freki - AT Prize Frigate')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "reason" = EXCLUDED."reason",
  "notes" = EXCLUDED."notes";

-- Revenant (time-based pricing - current price only, old price for reference)
-- Note: Multiple entries per typeId with different date ranges are not directly supported
-- in primary key constraint. Using most recent price.
INSERT INTO customprices ("typeId", "customPrice", "reason", "validFrom", "notes") VALUES
  (3514, 250000000000, 'at_ship', '2023-12-01', 'Revenant - 250B after Dec 2023 (was 100B before)')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "validFrom" = EXCLUDED."validFrom",
  "notes" = EXCLUDED."notes";

-- Alliance Tournament Cruisers (100B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (3518, 100000000000, 'at_ship', 'Vangel - AT Prize Cruiser'),
  (32788, 100000000000, 'at_ship', 'Cambion - AT Prize Cruiser'),
  (32790, 100000000000, 'at_ship', 'Etana - AT Prize Cruiser'),
  (32209, 100000000000, 'at_ship', 'Mimir - AT Prize Cruiser'),
  (11942, 100000000000, 'rare_ship', 'Silver Magnate - Ultra Rare'),
  (33673, 100000000000, 'at_ship', 'Whiptail - AT Prize')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Alliance Tournament Ships (120B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (35779, 120000000000, 'at_ship', 'Imp - AT Prize'),
  (42125, 120000000000, 'at_ship', 'Vendetta - AT Prize Supercarrier'),
  (42246, 120000000000, 'at_ship', 'Caedes - AT Prize'),
  (74141, 120000000000, 'at_ship', 'Geri - AT Prize')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Alliance Tournament Ships (150B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (2836, 150000000000, 'at_ship', 'Adrestia - AT Prize'),
  (33675, 150000000000, 'at_ship', 'Chameleon - AT Prize'),
  (35781, 150000000000, 'at_ship', 'Fiend - AT Prize'),
  (45530, 150000000000, 'at_ship', 'Virtuoso - AT Prize'),
  (48636, 150000000000, 'at_ship', 'Hydra - AT Prize'),
  (60765, 150000000000, 'at_ship', 'Raiju - AT Prize'),
  (74316, 150000000000, 'at_ship', 'Bestla - AT Prize'),
  (78414, 150000000000, 'at_ship', 'Shapash - AT Prize')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Alliance Tournament Ships (200B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (33397, 200000000000, 'at_ship', 'Chremoas - AT Prize'),
  (42245, 200000000000, 'at_ship', 'Rabisu - AT Prize'),
  (85062, 200000000000, 'at_ship', 'Sidewinder - AT Prize')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Alliance Tournament Ships (230B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (45531, 230000000000, 'at_ship', 'Victor - AT Prize'),
  (48635, 230000000000, 'at_ship', 'Tiamat - AT Prize'),
  (60764, 230000000000, 'at_ship', 'Laelaps - AT Prize'),
  (77726, 230000000000, 'at_ship', 'Cybele - AT Prize')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Alliance Tournament Ships (250B+)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (85229, 250000000000, 'at_ship', 'Cobra - AT Prize')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Structures
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (47512, 60000000000, 'rare_structure', 'Moreau Fortizar - 60B'),
  (47514, 60000000000, 'rare_structure', 'Horizon Fortizar - 60B (market bugginess)')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Special Capitals
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (45647, 60000000000, 'rare_ship', 'Caiman - 60B'),
  (42242, 60000000000, 'rare_ship', 'Dagon - 60B')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Rare Cruisers (500B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (635, 500000000000, 'rare_ship', 'Opux Luxury Yacht'),
  (11011, 500000000000, 'rare_ship', 'Guardian-Vexor'),
  (25560, 500000000000, 'rare_ship', 'Opux Dragoon Yacht'),
  (33395, 500000000000, 'at_ship', 'Moracha - AT Prize')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Faction Titans (550-650B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (45649, 550000000000, 'faction_titan', 'Komodo - Guristas Titan'),
  (42126, 650000000000, 'faction_titan', 'Vanquisher - Sansha Titan')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Molok (time-based pricing - current price only)
INSERT INTO customprices ("typeId", "customPrice", "reason", "validFrom", "notes") VALUES
  (42241, 650000000000, 'faction_titan', '2019-07-01', 'Molok - 650B after July 2019 (was 350B before)')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "validFrom" = EXCLUDED."validFrom",
  "notes" = EXCLUDED."notes";

-- Rare Battleships (750B)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (13202, 750000000000, 'rare_ship', 'Megathron Federate Issue'),
  (11936, 750000000000, 'rare_ship', 'Apocalypse Imperial Issue'),
  (11938, 750000000000, 'rare_ship', 'Armageddon Imperial Issue'),
  (26842, 750000000000, 'rare_ship', 'Tempest Tribal Issue'),
  (78576, 750000000000, 'faction_titan', 'Azariel - Angel Titan')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Ultra Rare Dev Ships (1T+)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (9860, 1000000000000, 'dev_ship', 'Polaris - Rare Dev Ship'),
  (11019, 1000000000000, 'dev_ship', 'Cockroach - Rare Dev Ship'),
  (85236, 1250000000000, 'at_ship', 'Python - AT Prize 1.25T')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Raven State Issue (2.5T)
INSERT INTO customprices ("typeId", "customPrice", "reason", "notes") VALUES
  (26840, 2500000000000, 'rare_ship', 'Raven State Issue - 2.5T')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "notes" = EXCLUDED."notes";

-- Gold Magnate (time-based pricing - current price only)
INSERT INTO customprices ("typeId", "customPrice", "reason", "validFrom", "notes") VALUES
  (11940, 3400000000000, 'rare_ship', '2020-01-25', 'Gold Magnate - 3.4T after Jan 2020 (was 500M before, ultra rare)')
ON CONFLICT ("typeId") DO UPDATE SET
  "customPrice" = EXCLUDED."customPrice",
  "validFrom" = EXCLUDED."validFrom",
  "notes" = EXCLUDED."notes";

-- Capsules (basic pricing)
-- Note: Using groupId 29 check in code instead of individual entries
