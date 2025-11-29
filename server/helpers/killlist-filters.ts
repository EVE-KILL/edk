import { type KilllistFilters } from '../models/killlist';

const CAPSULE_TYPE_IDS = [670, 40519]; // Standard and Genolution pods

function toNumber(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function toNumberArray(val: any): number[] | undefined {
  if (val === undefined || val === null) return undefined;
  const arr = Array.isArray(val) ? val : [val];
  const nums = arr.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return nums.length ? nums : undefined;
}

function toBoolean(val: any): boolean | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(str)) return true;
  if (['0', 'false', 'no', 'off'].includes(str)) return false;
  return undefined;
}

/**
 * Parse query params into KilllistFilters using DB-like param names.
 * Column-aligned param keys (all optional):
 *  - victimShipTypeId
 *  - victimShipGroupId
 *  - solarSystemId
 *  - constellationId
 *  - regionId
 *  - minTotalValue, maxTotalValue
 *  - minSecurityStatus, maxSecurityStatus
 *  - solo, npc, awox, big
 *  - shipGroupId (repeated) -> shipGroupIds
 *  - excludeTypeId (repeated) -> excludeTypeIds
 *  - attackerCharacterId / attackerCorporationId / attackerAllianceId
 *  - victimCharacterId / victimCorporationId / victimAllianceId
 *  - skipCapsules (boolean convenience; appends capsule type IDs)
 */
export function parseKilllistFilters(query: Record<string, any>): {
  filters: KilllistFilters;
  filterQueryString: string;
  securityStatus?: string;
  techLevel?: string;
  shipClass?: string;
} {
  const filters: KilllistFilters = {};
  let securityStatusValue: string | undefined;
  let techLevelValue: string | undefined;
  let shipClassValue: string | undefined;

  // Item filters - handle arrays with max 5 limit
  const maxItems = 5;
  const itemIds = (toNumberArray(query.victimShipTypeId) ?? []).concat(
    toNumberArray(query.itemId) ?? []
  );
  if (itemIds.length > 0) {
    filters.victimShipTypeIds = itemIds.slice(0, maxItems);
  } else {
    // Fallback to singular for backwards compatibility
    const singleItem =
      toNumber(query.victimShipTypeId) ?? toNumber(query.itemId);
    if (singleItem) filters.victimShipTypeId = singleItem;
  }
  filters.victimShipGroupId = toNumber(query.victimShipGroupId);
  // Location filters - handle arrays with max 5 limit
  const maxLocations = 5;
  const systemIds = toNumberArray(query.solarSystemId) ?? [];
  const constellationIds = (toNumberArray(query.constellationId) ?? []).concat(
    toNumberArray(query.solarConstellationId) ?? []
  );
  const regionIds = (toNumberArray(query.regionId) ?? []).concat(
    toNumberArray(query.solarRegionId) ?? []
  );

  if (systemIds.length > 0) {
    filters.solarSystemIds = systemIds.slice(0, maxLocations);
  } else {
    const singleSystem = toNumber(query.solarSystemId);
    if (singleSystem) filters.solarSystemId = singleSystem;
  }

  if (constellationIds.length > 0) {
    filters.constellationIds = constellationIds.slice(0, maxLocations);
  } else {
    const singleConstellation =
      toNumber(query.constellationId) ?? toNumber(query.solarConstellationId);
    if (singleConstellation) filters.constellationId = singleConstellation;
  }

  if (regionIds.length > 0) {
    filters.regionIds = regionIds.slice(0, maxLocations);
  } else {
    const singleRegion =
      toNumber(query.regionId) ?? toNumber(query.solarRegionId);
    if (singleRegion) filters.regionId = singleRegion;
  }

  filters.minTotalValue =
    toNumber(query.minTotalValue) ?? toNumber(query.minValue);
  filters.maxTotalValue = toNumber(query.maxTotalValue);

  // Handle security status filter
  // Special region IDs
  const WORMHOLE_REGION_MIN = 11000001;
  const WORMHOLE_REGION_MAX = 11000033;
  const ABYSSAL_REGION_MIN = 12000000;
  const ABYSSAL_REGION_MAX = 13000000;
  const POCHVEN_REGION_ID = 10000070;

  const securityStatus = query.securityStatus;
  if (securityStatus) {
    securityStatusValue = securityStatus;
    switch (securityStatus) {
      case 'highsec':
        filters.minSecurityStatus = 0.5;
        filters.maxSecurityStatus = 1.0;
        break;
      case 'lowsec':
        filters.minSecurityStatus = 0.0;
        filters.maxSecurityStatus = 0.5;
        break;
      case 'nullsec':
        filters.minSecurityStatus = -1.0;
        filters.maxSecurityStatus = 0.0;
        // Exclude wormholes from nullsec (they have negative security but are in special regions)
        filters.regionIdMin = 0;
        filters.regionIdMax = WORMHOLE_REGION_MIN - 1;
        break;
      case 'wormhole':
        // Wormholes are identified by regionId range, not security
        filters.regionIdMin = WORMHOLE_REGION_MIN;
        filters.regionIdMax = WORMHOLE_REGION_MAX;
        break;
      case 'abyssal':
        // Abyssal space is identified by regionId range
        filters.regionIdMin = ABYSSAL_REGION_MIN;
        filters.regionIdMax = ABYSSAL_REGION_MAX;
        break;
      case 'pochven':
        // Pochven is a specific region
        filters.regionId = POCHVEN_REGION_ID;
        break;
    }
  } else {
    filters.minSecurityStatus = toNumber(query.minSecurityStatus);
    filters.maxSecurityStatus = toNumber(query.maxSecurityStatus);
    filters.regionId = toNumber(query.regionId);
    filters.regionIdMin = toNumber(query.regionIdMin);
    filters.regionIdMax = toNumber(query.regionIdMax);
  }

  filters.isSolo = toBoolean(query.solo);
  filters.isNpc = toBoolean(query.npc);
  filters.isAwox = toBoolean(query.awox);
  filters.isBig = toBoolean(query.big);

  filters.excludeTypeIds = toNumberArray(query.excludeTypeId);

  // Handle attacker count filter
  const attackerCount = query.attackerCount;
  if (attackerCount) {
    switch (attackerCount) {
      case 'solo':
        filters.attackerCountMin = 1;
        filters.attackerCountMax = 1;
        break;
      case 'small':
        filters.attackerCountMin = 2;
        filters.attackerCountMax = 5;
        break;
      case 'medium':
        filters.attackerCountMin = 6;
        filters.attackerCountMax = 15;
        break;
      case 'large':
        filters.attackerCountMin = 16;
        filters.attackerCountMax = 50;
        break;
      case 'fleet':
        filters.attackerCountMin = 51;
        // No max for fleet
        break;
    }
  }

  // Handle time range filters
  // Default to last7days only if timeRange is not explicitly provided
  const timeRange =
    query.timeRange !== undefined ? query.timeRange : 'last7days';
  if (timeRange && timeRange !== '' && timeRange !== 'custom') {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'today':
        // Today from midnight
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        filters.killTimeFrom = startDate;
        filters.killTimeTo = now;
        break;
      case 'yesterday': {
        // Yesterday 00:00 to yesterday 23:59:59
        const yesterdayEnd = new Date(now);
        yesterdayEnd.setHours(0, 0, 0, 0);
        yesterdayEnd.setMilliseconds(-1); // End of yesterday
        startDate = new Date(yesterdayEnd);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        filters.killTimeFrom = startDate;
        filters.killTimeTo = yesterdayEnd;
        break;
      }
      case 'last7days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        filters.killTimeFrom = startDate;
        filters.killTimeTo = now;
        break;
      case 'thisweek': {
        // This week from Monday 00:00
        startDate = new Date(now);
        const dayOfWeek = startDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0
        startDate.setDate(startDate.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);
        filters.killTimeFrom = startDate;
        filters.killTimeTo = now;
        break;
      }
      case 'last30days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        filters.killTimeFrom = startDate;
        filters.killTimeTo = now;
        break;
      case 'thismonth':
        // This month from 1st 00:00
        startDate = new Date(now);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        filters.killTimeFrom = startDate;
        filters.killTimeTo = now;
        break;
    }
  } else if (timeRange === 'custom') {
    // Handle custom date range
    if (query.killTimeFrom) {
      const fromDate = new Date(query.killTimeFrom as string);
      if (!isNaN(fromDate.getTime())) {
        filters.killTimeFrom = fromDate;
      }
    }
    if (query.killTimeTo) {
      const toDate = new Date(query.killTimeTo as string);
      if (!isNaN(toDate.getTime())) {
        filters.killTimeTo = toDate;
      }
    }
  }

  // Handle ship class filter
  // Ship group IDs for different classes
  const SHIP_CLASS_GROUPS = {
    frigate: [324, 893, 25, 831, 237],
    destroyer: [420, 541],
    cruiser: [906, 26, 833, 358, 894, 832, 963], // includes strategic cruisers
    battlecruiser: [419, 540],
    battleship: [27, 898, 900],
    carrier: [547], // Carriers
    dreadnought: [485], // Dreadnoughts
    supercarrier: [659], // Supercarriers
    titan: [30], // Titans
    freighter: [513, 902], // Freighters and Jump Freighters
    industrial: [28, 380, 513, 902, 941, 883, 463, 543], // Industrial Ships, Haulers, Transports, Mining Barges, Exhumers, Industrial Command Ships, Capital Industrials
    structure: [1657, 1406, 1404, 1408, 2017, 2016], // Structures/Citadels
  };

  const shipClass = query.shipClass;
  if (
    shipClass &&
    SHIP_CLASS_GROUPS[shipClass as keyof typeof SHIP_CLASS_GROUPS]
  ) {
    shipClassValue = shipClass;
    filters.shipGroupIds =
      SHIP_CLASS_GROUPS[shipClass as keyof typeof SHIP_CLASS_GROUPS];
  } else {
    filters.shipGroupIds = toNumberArray(query.shipGroupId);
  }

  // Handle tech level filter
  // Meta Group IDs: 1=Tech I, 2=Tech II, 4=Faction, 3=Storyline, 6=Officer, 14=Tech III
  // T3 ships use specific ship groups (963=Strategic Cruiser, 1305=Tactical Destroyer)
  const T3_SHIP_GROUPS = [963, 1305];

  const techLevel = query.techLevel;
  if (techLevel) {
    techLevelValue = techLevel;
    switch (techLevel) {
      case 't1':
        filters.metaGroupIds = [1]; // Tech I
        break;
      case 't2':
        filters.metaGroupIds = [2]; // Tech II
        break;
      case 't3':
        // T3 ships are identified by ship group, not meta group
        filters.shipGroupIds = T3_SHIP_GROUPS;
        break;
      case 'faction':
        filters.metaGroupIds = [4]; // Faction ships (not including storyline modules)
        break;
      case 'officer':
        filters.metaGroupIds = [6]; // Officer
        break;
    }
  } else {
    filters.metaGroupIds = toNumberArray(query.metaGroupId);
  }

  // Entity filters - handle both singular and array formats (max 15 per category)
  const maxEntities = 15;
  const victimCharIds = (toNumberArray(query.victimCharacterId) ?? []).slice(
    0,
    maxEntities
  );
  const victimCorpIds = (toNumberArray(query.victimCorporationId) ?? []).slice(
    0,
    maxEntities
  );
  const victimAllyIds = (toNumberArray(query.victimAllianceId) ?? []).slice(
    0,
    maxEntities
  );
  const attackerCharIds = (
    toNumberArray(query.attackerCharacterId) ?? []
  ).slice(0, maxEntities);
  const attackerCorpIds = (
    toNumberArray(query.attackerCorporationId) ?? []
  ).slice(0, maxEntities);
  const attackerAllyIds = (toNumberArray(query.attackerAllianceId) ?? []).slice(
    0,
    maxEntities
  );
  const bothCharIds = (toNumberArray(query.bothCharacterId) ?? []).slice(
    0,
    maxEntities
  );
  const bothCorpIds = (toNumberArray(query.bothCorporationId) ?? []).slice(
    0,
    maxEntities
  );
  const bothAllyIds = (toNumberArray(query.bothAllianceId) ?? []).slice(
    0,
    maxEntities
  );

  if (victimCharIds.length > 0) filters.victimCharacterIds = victimCharIds;
  if (victimCorpIds.length > 0) filters.victimCorporationIds = victimCorpIds;
  if (victimAllyIds.length > 0) filters.victimAllianceIds = victimAllyIds;
  if (attackerCharIds.length > 0)
    filters.attackerCharacterIds = attackerCharIds;
  if (attackerCorpIds.length > 0)
    filters.attackerCorporationIds = attackerCorpIds;
  if (attackerAllyIds.length > 0) filters.attackerAllianceIds = attackerAllyIds;
  if (bothCharIds.length > 0) filters.bothCharacterIds = bothCharIds;
  if (bothCorpIds.length > 0) filters.bothCorporationIds = bothCorpIds;
  if (bothAllyIds.length > 0) filters.bothAllianceIds = bothAllyIds;

  // Handle capsule filtering
  const noCapsules =
    toBoolean(query.noCapsules) || toBoolean(query.skipCapsules);
  if (noCapsules) {
    filters.noCapsules = true;
  }

  // Drop undefined entries so we don't clobber defaults when merging
  for (const key of Object.keys(filters) as Array<keyof KilllistFilters>) {
    if (filters[key] === undefined) {
      delete filters[key];
    }
  }

  // Build query string preserving the original parameter names and values
  const params = new URLSearchParams();
  const addParam = (key: string, value: any) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.append(key, String(value));
    }
  };

  // Preserve original query parameter names for items
  if (query.itemId) {
    addParam('itemId', query.itemId);
  } else if (query.victimShipTypeId) {
    addParam('victimShipTypeId', query.victimShipTypeId);
  }
  addParam('victimShipGroupId', query.victimShipGroupId);

  // Preserve original query parameter names for locations
  if (query.solarSystemId) {
    addParam('solarSystemId', query.solarSystemId);
  }
  if (query.solarConstellationId) {
    addParam('solarConstellationId', query.solarConstellationId);
  } else if (query.constellationId) {
    addParam('constellationId', query.constellationId);
  }
  if (query.solarRegionId) {
    addParam('solarRegionId', query.solarRegionId);
  } else if (query.regionId) {
    addParam('regionId', query.regionId);
  }
  addParam('minTotalValue', filters.minTotalValue);
  addParam('maxTotalValue', filters.maxTotalValue);
  if (query.securityStatus) {
    addParam('securityStatus', query.securityStatus);
  } else {
    addParam('minSecurityStatus', filters.minSecurityStatus);
    addParam('maxSecurityStatus', filters.maxSecurityStatus);
  }
  addParam('solo', query.solo);
  addParam('npc', query.npc);
  addParam('awox', query.awox);
  addParam('big', query.big);
  if (query.shipGroupId) {
    addParam('shipGroupId', query.shipGroupId);
  }
  if (query.excludeTypeId) {
    addParam('excludeTypeId', query.excludeTypeId);
  }
  if (query.victimCharacterId) {
    addParam('victimCharacterId', query.victimCharacterId);
  }
  if (query.victimCorporationId) {
    addParam('victimCorporationId', query.victimCorporationId);
  }
  if (query.victimAllianceId) {
    addParam('victimAllianceId', query.victimAllianceId);
  }
  if (query.attackerCharacterId) {
    addParam('attackerCharacterId', query.attackerCharacterId);
  }
  if (query.attackerCorporationId) {
    addParam('attackerCorporationId', query.attackerCorporationId);
  }
  if (query.attackerAllianceId) {
    addParam('attackerAllianceId', query.attackerAllianceId);
  }
  if (query.bothCharacterId) {
    addParam('bothCharacterId', query.bothCharacterId);
  }
  if (query.bothCorporationId) {
    addParam('bothCorporationId', query.bothCorporationId);
  }
  if (query.bothAllianceId) {
    addParam('bothAllianceId', query.bothAllianceId);
  }
  if (query.regionIdMin) {
    addParam('regionIdMin', query.regionIdMin);
  }
  if (query.regionIdMax) {
    addParam('regionIdMax', query.regionIdMax);
  }
  if (query.techLevel) {
    addParam('techLevel', query.techLevel);
  }
  if (query.metaGroupId) {
    addParam('metaGroupId', query.metaGroupId);
  }
  if (query.shipClass) {
    addParam('shipClass', query.shipClass);
  }
  if (query.noCapsules || query.skipCapsules) {
    addParam('noCapsules', '1');
  }
  if (query.attackerCount) {
    addParam('attackerCount', query.attackerCount);
  }
  if (query.timeRange) {
    addParam('timeRange', query.timeRange);
  }
  if (query.timeRange === 'custom') {
    if (query.killTimeFrom) {
      addParam('killTimeFrom', query.killTimeFrom);
    }
    if (query.killTimeTo) {
      addParam('killTimeTo', query.killTimeTo);
    }
  }

  return {
    filters,
    filterQueryString: params.toString(),
    securityStatus: securityStatusValue,
    techLevel: techLevelValue,
    shipClass: shipClassValue,
  };
}

export { CAPSULE_TYPE_IDS };
