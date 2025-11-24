/**
 * Killmail WebSocket Handler
 * Topic-based routing and validation for killmail events
 */

import type { ClientData, MessageHandler } from '../common';

// Valid topics
export const validTopics = [
  'all',
  'latest',
  '10b',
  '5b',
  'big',
  'bigkills',
  'solo',
  'npc',
  'awox',
  'highsec',
  'lowsec',
  'nullsec',
  'w-space',
  'wspace',
  'abyssal',
  'pochven',
  'frigates',
  'destroyers',
  'cruisers',
  'battlecruisers',
  'battleships',
  'capitals',
  'supercarriers',
  'titans',
  'freighters',
  'citadels',
  'structures',
  't1',
  't2',
  't3',
];

export const partialTopics = ['victim.', 'attacker.', 'system.', 'region.'];

/**
 * Check if a topic is valid
 */
function isValidTopic(topic: string): boolean {
  if (validTopics.includes(topic)) return true;
  return partialTopics.some((prefix) => topic.startsWith(prefix));
}

// Ship group IDs for routing
const SHIP_GROUPS = {
  big: [547, 485, 513, 902, 941, 30, 659],
  frigates: [324, 893, 25, 831, 237],
  destroyers: [420, 541],
  cruisers: [906, 26, 833, 358, 894, 832, 963],
  battlecruisers: [419, 540],
  battleships: [27, 898, 900],
  capitals: [547, 485],
  freighters: [513, 902],
  supercarriers: [659],
  titans: [30],
  citadels: [1657, 1406, 1404, 1408, 2017, 2016],
  t1: [419, 27, 29, 547, 26, 420, 25, 28, 941, 463, 237, 31],
  t2: [
    324, 898, 906, 540, 830, 893, 543, 541, 833, 358, 894, 831, 902, 832, 900,
    834, 380,
  ],
  t3: [963, 1305],
};

// W-Space region ID range
const WSPACE_REGION_MIN = 11000001;
const WSPACE_REGION_MAX = 11000033;

// Abyssal region ID range
const ABYSSAL_REGION_MIN = 12000000;
const ABYSSAL_REGION_MAX = 13000000;

// Pochven region ID
const POCHVEN_REGION_ID = 10000070;

/**
 * Generate routing keys for a killmail
 */
function generateRoutingKeys(killmail: any): string[] {
  const keys: string[] = ['all', 'latest'];

  // Value-based routing
  const totalValue = Number(killmail.totalValue || 0);
  if (totalValue >= 10_000_000_000) {
    keys.push('10b');
    keys.push('big');
    keys.push('bigkills');
  } else if (totalValue >= 5_000_000_000) {
    keys.push('5b');
    keys.push('big');
    keys.push('bigkills');
  } else if (totalValue >= 1_000_000_000) {
    keys.push('big');
    keys.push('bigkills');
  }

  // Security status routing
  const securityStatus =
    killmail.solarSystem?.securityStatus ?? killmail.securityStatus;
  if (securityStatus !== undefined && securityStatus !== null) {
    if (securityStatus >= 0.45) {
      keys.push('highsec');
    } else if (securityStatus > 0.0) {
      keys.push('lowsec');
    } else if (securityStatus <= 0.0) {
      keys.push('nullsec');
    }
  }

  // Region-based routing (W-Space, Abyssal, Pochven)
  const regionId = killmail.solarSystem?.regionId ?? killmail.regionId;
  if (regionId !== undefined && regionId !== null) {
    if (regionId >= WSPACE_REGION_MIN && regionId <= WSPACE_REGION_MAX) {
      keys.push('w-space');
      keys.push('wspace');
    } else if (
      regionId >= ABYSSAL_REGION_MIN &&
      regionId < ABYSSAL_REGION_MAX
    ) {
      keys.push('abyssal');
    } else if (regionId === POCHVEN_REGION_ID) {
      keys.push('pochven');
    }
  }

  // Ship group routing
  const shipGroupId = killmail.victim?.ship?.groupId;
  if (shipGroupId) {
    // Check each ship group category
    if (SHIP_GROUPS.frigates.includes(shipGroupId)) keys.push('frigates');
    if (SHIP_GROUPS.destroyers.includes(shipGroupId)) keys.push('destroyers');
    if (SHIP_GROUPS.cruisers.includes(shipGroupId)) keys.push('cruisers');
    if (SHIP_GROUPS.battlecruisers.includes(shipGroupId))
      keys.push('battlecruisers');
    if (SHIP_GROUPS.battleships.includes(shipGroupId)) keys.push('battleships');
    if (SHIP_GROUPS.capitals.includes(shipGroupId)) keys.push('capitals');
    if (SHIP_GROUPS.freighters.includes(shipGroupId)) keys.push('freighters');
    if (SHIP_GROUPS.supercarriers.includes(shipGroupId))
      keys.push('supercarriers');
    if (SHIP_GROUPS.titans.includes(shipGroupId)) keys.push('titans');
    if (SHIP_GROUPS.citadels.includes(shipGroupId)) {
      keys.push('citadels');
      keys.push('structures');
    }
    if (SHIP_GROUPS.t1.includes(shipGroupId)) keys.push('t1');
    if (SHIP_GROUPS.t2.includes(shipGroupId)) keys.push('t2');
    if (SHIP_GROUPS.t3.includes(shipGroupId)) keys.push('t3');
  }

  // System-based routing
  if (killmail.solarSystemId) keys.push(`system.${killmail.solarSystemId}`);
  if (killmail.regionName) keys.push(`region.${killmail.regionName}`);

  // Solo/NPC/Awox flags
  if (killmail.solo) keys.push('solo');
  if (killmail.npc) keys.push('npc');
  if (killmail.awox) keys.push('awox');

  // Victim-based routing
  if (killmail.victim) {
    if (killmail.victim.character?.id)
      keys.push(`victim.${killmail.victim.character.id}`);
    if (killmail.victim.corporation?.id)
      keys.push(`victim.${killmail.victim.corporation.id}`);
    if (killmail.victim.alliance?.id)
      keys.push(`victim.${killmail.victim.alliance.id}`);
  }

  // Attacker-based routing (from first attacker)
  if (
    killmail.attackers &&
    Array.isArray(killmail.attackers) &&
    killmail.attackers[0]
  ) {
    const attacker = killmail.attackers[0];
    if (attacker.character?.id) keys.push(`attacker.${attacker.character.id}`);
    if (attacker.corporation?.id)
      keys.push(`attacker.${attacker.corporation.id}`);
    if (attacker.alliance?.id) keys.push(`attacker.${attacker.alliance.id}`);
  }

  return keys;
}

/**
 * Check if killmail should be sent to a client
 */
function shouldSendToClient(killmail: any, clientData: ClientData): boolean {
  if (clientData.topics.length === 0) return false;
  const routingKeys = generateRoutingKeys(killmail);
  return clientData.topics.some((topic) => routingKeys.includes(topic));
}

// Message handler for killmail-specific logic
export const killmailMessageHandler: MessageHandler = {
  isValidTopic,
  generateRoutingKeys,
  shouldSendToClient,
  getMessageType: (_data: any) => 'killmail',
  getLogIdentifier: (data: any) => data.killmailId || 'unknown',
};
