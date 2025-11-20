-- Dictionary definitions for fast entity lookups used by dictGet* calls

USE edk;

CREATE DICTIONARY IF NOT EXISTS characters_dict
(
    characterId UInt32,
    name String
)
PRIMARY KEY characterId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            characterId,
            argMax(name, updatedAt) AS name
        FROM edk.characters
        GROUP BY characterId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS npc_characters_dict
(
    characterId UInt32,
    name String
)
PRIMARY KEY characterId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            characterId,
            argMax(name, version) AS name
        FROM edk.npcCharacters
        GROUP BY characterId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS corporations_dict
(
    corporationId UInt32,
    name String,
    ticker String
)
PRIMARY KEY corporationId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            corporationId,
            argMax(name, updatedAt) AS name,
            argMax(coalesce(ticker, ''''), updatedAt) AS ticker
        FROM edk.corporations
        GROUP BY corporationId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS npc_corporations_dict
(
    corporationId UInt32,
    name String,
    ticker String
)
PRIMARY KEY corporationId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            corporationId,
            argMax(name, version) AS name,
            argMax(coalesce(tickerName, ''''), version) AS ticker
        FROM edk.npcCorporations
        GROUP BY corporationId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS alliances_dict
(
    allianceId UInt32,
    name String,
    ticker String
)
PRIMARY KEY allianceId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            allianceId,
            argMax(name, updatedAt) AS name,
            argMax(coalesce(ticker, ''''), updatedAt) AS ticker
        FROM edk.alliances
        GROUP BY allianceId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS solar_systems_dict
(
    solarSystemId UInt32,
    name String,
    regionId UInt32
)
PRIMARY KEY solarSystemId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            solarSystemId,
            argMax(name, updatedAt) AS name,
            argMax(regionId, updatedAt) AS regionId
        FROM edk.solarSystems
        GROUP BY solarSystemId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS regions_dict
(
    regionId UInt32,
    name String
)
PRIMARY KEY regionId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            regionId,
            argMax(name, updatedAt) AS name
        FROM edk.regions
        GROUP BY regionId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS types_dict
(
    typeId UInt32,
    name String,
    groupId UInt32
)
PRIMARY KEY typeId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            typeId,
            argMax(name, version) AS name,
            argMax(groupId, version) AS groupId
        FROM edk.types
        GROUP BY typeId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());

CREATE DICTIONARY IF NOT EXISTS groups_dict
(
    groupId UInt32,
    name String
)
PRIMARY KEY groupId
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT 9000
    USER 'edk_user'
    PASSWORD 'edk_password'
    DB 'edk'
    QUERY '
        SELECT
            groupId,
            argMax(name, version) AS name
        FROM edk.groups
        GROUP BY groupId
    '
))
LIFETIME(MIN 60 MAX 300)
LAYOUT(HASHED());
