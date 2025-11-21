-- Drop existing views in reverse order of dependency
DROP MATERIALIZED VIEW IF EXISTS top_characters_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_corporations_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_alliances_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_systems_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_regions_weekly;
DROP MATERIALIZED VIEW IF EXISTS kill_list;

-- Recreate kill_list with all necessary columns
CREATE MATERIALIZED VIEW kill_list AS
SELECT
    k."killmailId",
    k."killmailTime",
    k."solarSystemId",
    ss.name AS "solarSystemName",
    ss."regionId",
    r.name AS "regionName",
    ss."securityStatus" AS security,
    k."victimCharacterId",
    COALESCE(vc.name, vnpc.name, 'Unknown') AS "victimCharacterName",
    k."victimCorporationId",
    COALESCE(vcorp.name, vnpc_corp.name, 'Unknown') AS "victimCorporationName",
    COALESCE(vcorp.ticker, vnpc_corp."tickerName", '???') AS "victimCorporationTicker",
    k."victimAllianceId",
    valliance.name AS "victimAllianceName",
    valliance.ticker AS "victimAllianceTicker",
    k."victimShipTypeId",
    COALESCE(vship.name, 'Unknown') AS "victimShipName",
    COALESCE(vshipgroup.name, 'Unknown') AS "victimShipGroup",
    vship."groupId" AS "victimShipGroupId",
    k."victimDamageTaken",
    k."topAttackerCharacterId" AS "attackerCharacterId",
    COALESCE(ac.name, anpc.name, 'Unknown') AS "attackerCharacterName",
    k."topAttackerCorporationId" AS "attackerCorporationId",
    COALESCE(acorp.name, anpc_corp.name, 'Unknown') AS "attackerCorporationName",
    COALESCE(acorp.ticker, anpc_corp."tickerName", '???') AS "attackerCorporationTicker",
    k."topAttackerAllianceId" AS "attackerAllianceId",
    aalliance.name AS "attackerAllianceName",
    aalliance.ticker AS "attackerAllianceTicker",
    k."topAttackerShipTypeId" AS "attackerShipTypeId",
    COALESCE(aship.name, 'Unknown') as "attackerShipName",
    k."totalValue",
    k."attackerCount",
    k.npc,
    k.solo,
    k.awox
FROM killmails k
LEFT JOIN solarsystems ss ON k."solarSystemId" = ss."solarSystemId"
LEFT JOIN regions r ON ss."regionId" = r."regionId"
-- Victim JOINs
LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
LEFT JOIN npccharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
LEFT JOIN npccorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"
-- Attacker JOINs
LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
LEFT JOIN npccharacters anpc ON k."topAttackerCharacterId" = anpc."characterId"
LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
LEFT JOIN npccorporations anpc_corp ON k."topAttackerCorporationId" = anpc_corp."corporationId"
LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"
LEFT JOIN types aship ON k."topAttackerShipTypeId" = aship."typeId";

-- Add indexes to kill_list
CREATE UNIQUE INDEX IF NOT EXISTS kill_list_killmail_id_idx ON kill_list("killmailId");
CREATE INDEX IF NOT EXISTS kill_list_killmail_time_idx ON kill_list("killmailTime" DESC);

-- Create top stats views
CREATE MATERIALIZED VIEW IF NOT EXISTS top_characters_weekly AS
SELECT
    "attackerCharacterId" AS id,
    "attackerCharacterName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days' AND "attackerCharacterId" IS NOT NULL
GROUP BY "attackerCharacterId", "attackerCharacterName"
ORDER BY "iskDestroyed" DESC
LIMIT 10;
CREATE UNIQUE INDEX IF NOT EXISTS top_characters_weekly_id_idx ON top_characters_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_corporations_weekly AS
SELECT
    "attackerCorporationId" AS id,
    "attackerCorporationName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days' AND "attackerCorporationId" IS NOT NULL
GROUP BY "attackerCorporationId", "attackerCorporationName"
ORDER BY "iskDestroyed" DESC
LIMIT 10;
CREATE UNIQUE INDEX IF NOT EXISTS top_corporations_weekly_id_idx ON top_corporations_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_alliances_weekly AS
SELECT
    "attackerAllianceId" AS id,
    "attackerAllianceName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days' AND "attackerAllianceId" IS NOT NULL
GROUP BY "attackerAllianceId", "attackerAllianceName"
ORDER BY "iskDestroyed" DESC
LIMIT 10;
CREATE UNIQUE INDEX IF NOT EXISTS top_alliances_weekly_id_idx ON top_alliances_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_systems_weekly AS
SELECT
    "solarSystemId" AS id,
    "solarSystemName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days'
GROUP BY "solarSystemId", "solarSystemName"
ORDER BY "iskDestroyed" DESC
LIMIT 10;
CREATE UNIQUE INDEX IF NOT EXISTS top_systems_weekly_id_idx ON top_systems_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_regions_weekly AS
SELECT
    "regionId" AS id,
    "regionName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days'
GROUP BY "regionId", "regionName"
ORDER BY "iskDestroyed" DESC
LIMIT 10;
CREATE UNIQUE INDEX IF NOT EXISTS top_regions_weekly_id_idx ON top_regions_weekly(id);
