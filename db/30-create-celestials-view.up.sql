CREATE MATERIALIZED VIEW IF NOT EXISTS celestials AS
SELECT
    "regionId" AS "itemId",
    "name" AS "itemName",
    3 AS "typeId",
    3 AS "groupId",
    CAST(NULL AS INTEGER) AS "solarSystemId",
    CAST(NULL AS INTEGER) AS "constellationId",
    "regionId" AS "regionId",
    "positionX" AS x,
    "positionY" AS y,
    "positionZ" AS z,
    CAST(NULL AS REAL) AS security
FROM
    regions
UNION ALL
SELECT
    "constellationId" AS "itemId",
    "name" AS "itemName",
    4 AS "typeId",
    4 AS "groupId",
    CAST(NULL AS INTEGER) AS "solarSystemId",
    "constellationId" AS "constellationId",
    "regionId" AS "regionId",
    "positionX" AS x,
    "positionY" AS y,
    "positionZ" AS z,
    CAST(NULL AS REAL) AS security
FROM
    constellations
UNION ALL
SELECT
    "solarSystemId" AS "itemId",
    "name" AS "itemName",
    5 AS "typeId",
    5 AS "groupId",
    "solarSystemId" AS "solarSystemId",
    "constellationId" AS "constellationId",
    "regionId" AS "regionId",
    "positionX" AS x,
    "positionY" AS y,
    "positionZ" AS z,
    "securityStatus" AS security
FROM
    solarSystems
UNION ALL
SELECT
    s."starId" AS "itemId",
    s."name" AS "itemName",
    s."typeId" AS "typeId",
    t."groupId" AS "groupId",
    s."solarSystemId" AS "solarSystemId",
    ss."constellationId" AS "constellationId",
    ss."regionId" AS "regionId",
    ss."positionX" AS x,
    ss."positionY" AS y,
    ss."positionZ" AS z,
    ss."securityStatus" AS security
FROM
    stars s
    JOIN types t ON s."typeId" = t."typeId"
    JOIN solarSystems ss ON s."solarSystemId" = ss."solarSystemId"
UNION ALL
SELECT
    p."planetId" AS "itemId",
    p."name" AS "itemName",
    p."typeId" AS "typeId",
    t."groupId" AS "groupId",
    p."solarSystemId" AS "solarSystemId",
    ss."constellationId" AS "constellationId",
    ss."regionId" AS "regionId",
    (p."positionX" + ss."positionX") AS x,
    (p."positionY" + ss."positionY") AS y,
    (p."positionZ" + ss."positionZ") AS z,
    ss."securityStatus" AS security
FROM
    planets p
    JOIN types t ON p."typeId" = t."typeId"
    JOIN solarSystems ss ON p."solarSystemId" = ss."solarSystemId"
UNION ALL
SELECT
    m."moonId" AS "itemId",
    m."name" AS "itemName",
    m."typeId" AS "typeId",
    t."groupId" AS "groupId",
    m."solarSystemId" AS "solarSystemId",
    ss."constellationId" AS "constellationId",
    ss."regionId" AS "regionId",
    (m."positionX" + ss."positionX") AS x,
    (m."positionY" + ss."positionY") AS y,
    (m."positionZ" + ss."positionZ") AS z,
    ss."securityStatus" AS security
FROM
    moons m
    JOIN types t ON m."typeId" = t."typeId"
    JOIN solarSystems ss ON m."solarSystemId" = ss."solarSystemId"
UNION ALL
SELECT
    ab."asteroidBeltId" AS "itemId",
    ab."name" AS "itemName",
    ab."typeId" AS "typeId",
    t."groupId" AS "groupId",
    ab."solarSystemId" AS "solarSystemId",
    ss."constellationId" AS "constellationId",
    ss."regionId" AS "regionId",
    (ab."positionX" + ss."positionX") AS x,
    (ab."positionY" + ss."positionY") AS y,
    (ab."positionZ" + ss."positionZ") AS z,
    ss."securityStatus" AS security
FROM
    asteroidBelts ab
    JOIN types t ON ab."typeId" = t."typeId"
    JOIN solarSystems ss ON ab."solarSystemId" = ss."solarSystemId";

CREATE UNIQUE INDEX IF NOT EXISTS celestials_item_id_idx ON celestials ("itemId");
