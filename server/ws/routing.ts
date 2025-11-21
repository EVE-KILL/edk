import { EntityKillmail } from '~/models/killlist'

export function determineRoutingKeys(killmail: EntityKillmail): string[] {
  const routingKeys = new Set(['all'])
  const totalValue = Number(killmail.totalValue) || 0

  if (totalValue > 1_000_000_000) routingKeys.add('10b')
  if (totalValue > 500_000_000) routingKeys.add('5b')

  routingKeys.add(`victim.${killmail.victimCharacterId}`)
  routingKeys.add(`victim.${killmail.victimCorporationId}`)
  if (killmail.victimAllianceId) routingKeys.add(`victim.${killmail.victimAllianceId}`)

  routingKeys.add(`attacker.${killmail.attackerCharacterId}`)
  routingKeys.add(`attacker.${killmail.attackerCorporationId}`)
  if (killmail.attackerAllianceId) routingKeys.add(`attacker.${killmail.attackerAllianceId}`)

  routingKeys.add(`system.${killmail.solarSystemId}`)
  routingKeys.add(`region.${killmail.regionName}`)

  return Array.from(routingKeys)
}
