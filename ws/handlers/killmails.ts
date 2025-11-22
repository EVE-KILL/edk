/**
 * Killmail WebSocket Handler
 * Topic-based routing and validation for killmail events
 */

import type { ClientData, MessageHandler } from '../common'

// Valid topics
export const validTopics = [
  'all',
  '10b',
  '5b',
  'abyssal',
  'wspace',
  'pochven',
  'highsec',
  'lowsec',
  'nullsec',
  'bigkills',
  'solo',
  'npc',
  'awox',
  't1',
  't2',
  't3',
  'frigates',
  'destroyers',
  'cruisers',
  'battlecruisers',
  'battleships',
  'capitals',
  'freighters',
  'supercarriers',
  'titans',
]

export const partialTopics = ['victim.', 'attacker.', 'system.', 'region.']

/**
 * Check if a topic is valid
 */
function isValidTopic(topic: string): boolean {
  if (validTopics.includes(topic)) return true
  return partialTopics.some((prefix) => topic.startsWith(prefix))
}

/**
 * Generate routing keys for a killmail
 */
function generateRoutingKeys(killmail: any): string[] {
  const keys: string[] = ['all']

  // Value-based routing
  const totalValue = Number(killmail.totalValue || 0)
  if (totalValue >= 10_000_000_000) keys.push('10b')
  if (totalValue >= 5_000_000_000) keys.push('5b')
  if (totalValue >= 1_000_000_000) keys.push('bigkills')

  // System-based routing
  if (killmail.solarSystemId) keys.push(`system.${killmail.solarSystemId}`)
  if (killmail.regionName) keys.push(`region.${killmail.regionName}`)

  // Solo/NPC/Awox flags
  if (killmail.solo) keys.push('solo')
  if (killmail.npc) keys.push('npc')
  if (killmail.awox) keys.push('awox')

  // Victim-based routing
  if (killmail.victim) {
    if (killmail.victim.character?.id) keys.push(`victim.${killmail.victim.character.id}`)
    if (killmail.victim.corporation?.id) keys.push(`victim.${killmail.victim.corporation.id}`)
    if (killmail.victim.alliance?.id) keys.push(`victim.${killmail.victim.alliance.id}`)
  }

  // Attacker-based routing (from first attacker)
  if (killmail.attackers && Array.isArray(killmail.attackers) && killmail.attackers[0]) {
    const attacker = killmail.attackers[0]
    if (attacker.character?.id) keys.push(`attacker.${attacker.character.id}`)
    if (attacker.corporation?.id) keys.push(`attacker.${attacker.corporation.id}`)
    if (attacker.alliance?.id) keys.push(`attacker.${attacker.alliance.id}`)
  }

  return keys
}

/**
 * Check if killmail should be sent to a client
 */
function shouldSendToClient(killmail: any, clientData: ClientData): boolean {
  if (clientData.topics.length === 0) return false
  const routingKeys = generateRoutingKeys(killmail)
  return clientData.topics.some((topic) => routingKeys.includes(topic))
}

// Message handler for killmail-specific logic
export const killmailMessageHandler: MessageHandler = {
  isValidTopic,
  generateRoutingKeys,
  shouldSendToClient,
  getMessageType: (data: any) => 'killmail',
  getLogIdentifier: (data: any) => data.killmailId || 'unknown',
}
