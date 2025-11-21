import { ClientData, MessageHandler } from '../common'
import { determineRoutingKeys } from '../routing'
import { EntityKillmail } from '~/models/killlist'

export const validTopics = [
  'all',
  '10b',
  '5b',
]

export const partialTopics = ['victim.', 'attacker.', 'system.', 'region.']

function isValidTopic(topic: string): boolean {
  if (validTopics.includes(topic)) return true
  return partialTopics.some((prefix) => topic.startsWith(prefix))
}

function shouldSendToClient(killmail: any, clientData: ClientData): boolean {
  if (clientData.topics.length === 0) return false
  const routingKeys = determineRoutingKeys(killmail as EntityKillmail)
  return clientData.topics.some((topic) => routingKeys.includes(topic))
}

export const killmailMessageHandler: MessageHandler = {
  isValidTopic,
  shouldSendToClient,
  getMessageType: (data: any) => 'killmail',
  getLogIdentifier: (data: any) => (data as EntityKillmail).killmailId || 'unknown',
}
