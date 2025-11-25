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

  filters.victimShipTypeId = toNumber(query.victimShipTypeId);
  filters.victimShipGroupId = toNumber(query.victimShipGroupId);
  filters.solarSystemId = toNumber(query.solarSystemId);
  filters.constellationId = toNumber(query.constellationId);
  filters.regionId = toNumber(query.regionId);

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

  filters.attackerCharacterId = toNumber(query.attackerCharacterId);
  filters.attackerCorporationId = toNumber(query.attackerCorporationId);
  filters.attackerAllianceId = toNumber(query.attackerAllianceId);
  filters.victimCharacterId = toNumber(query.victimCharacterId);
  filters.victimCorporationId = toNumber(query.victimCorporationId);
  filters.victimAllianceId = toNumber(query.victimAllianceId);

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

  // Build query string preserving the parsed values (repeat arrays).
  const params = new URLSearchParams();
  const addParam = (key: string, value: any) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.append(key, String(value));
    }
  };

  addParam('victimShipTypeId', filters.victimShipTypeId);
  addParam('victimShipGroupId', filters.victimShipGroupId);
  addParam('solarSystemId', filters.solarSystemId);
  addParam('constellationId', filters.constellationId);
  addParam('regionId', filters.regionId);
  addParam('minTotalValue', filters.minTotalValue);
  addParam('maxTotalValue', filters.maxTotalValue);
  if (query.securityStatus) {
    addParam('securityStatus', query.securityStatus);
  } else {
    addParam('minSecurityStatus', filters.minSecurityStatus);
    addParam('maxSecurityStatus', filters.maxSecurityStatus);
  }
  addParam('solo', filters.isSolo);
  addParam('npc', filters.isNpc);
  addParam('awox', filters.isAwox);
  addParam('big', filters.isBig);
  addParam('shipGroupId', filters.shipGroupIds);
  addParam('excludeTypeId', filters.excludeTypeIds);
  addParam('attackerCharacterId', filters.attackerCharacterId);
  addParam('attackerCorporationId', filters.attackerCorporationId);
  addParam('attackerAllianceId', filters.attackerAllianceId);
  addParam('victimCharacterId', filters.victimCharacterId);
  addParam('victimCorporationId', filters.victimCorporationId);
  addParam('victimAllianceId', filters.victimAllianceId);
  addParam('regionIdMin', filters.regionIdMin);
  addParam('regionIdMax', filters.regionIdMax);
  if (query.techLevel) {
    addParam('techLevel', query.techLevel);
  } else {
    addParam('metaGroupId', filters.metaGroupIds);
  }
  if (query.shipClass) {
    addParam('shipClass', query.shipClass);
  } else {
    addParam('shipGroupId', filters.shipGroupIds);
  }
  if (filters.noCapsules) addParam('noCapsules', '1');

  return {
    filters,
    filterQueryString: params.toString(),
    securityStatus: securityStatusValue,
    techLevel: techLevelValue,
    shipClass: shipClassValue,
  };
}

export { CAPSULE_TYPE_IDS };
