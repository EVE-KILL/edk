/**
 * Killmail detail page
 * Shows complete killmail information including victim, attackers, items, and stats
 * Layout: 65% left (items/fitting wheel), 35% right (victim/attackers)
 */
import type { H3Event } from 'h3'
import { timeAgo } from '../../helpers/time'
import { render } from '../../helpers/templates'
import {
  getKillmailDetails,
  getKillmailItems,
  getKillmailAttackers,
  getSiblingKillmails
} from '../../models/killmails'

// Item slot mapping - which flag number corresponds to which slot
const SLOT_MAPPING: Record<number, string> = {
  // High slots (27-34)
  27: 'highSlots', 28: 'highSlots', 29: 'highSlots', 30: 'highSlots',
  31: 'highSlots', 32: 'highSlots', 33: 'highSlots', 34: 'highSlots',
  // Med slots (19-26)
  19: 'medSlots', 20: 'medSlots', 21: 'medSlots', 22: 'medSlots',
  23: 'medSlots', 24: 'medSlots', 25: 'medSlots', 26: 'medSlots',
  // Low slots (11-18)
  11: 'lowSlots', 12: 'lowSlots', 13: 'lowSlots', 14: 'lowSlots',
  15: 'lowSlots', 16: 'lowSlots', 17: 'lowSlots', 18: 'lowSlots',
  // Rig slots (92-94)
  92: 'rigSlots', 93: 'rigSlots', 94: 'rigSlots',
  // Subsystem slots (125-128)
  125: 'subSlots', 126: 'subSlots', 127: 'subSlots', 128: 'subSlots',
  // Drone bay
  87: 'droneBay',
  // Cargo/Container (5)
  5: 'cargo'
}

const SLOT_NAMES: Record<number, string> = {
  27: 'High Slot 1', 28: 'High Slot 2', 29: 'High Slot 3', 30: 'High Slot 4',
  31: 'High Slot 5', 32: 'High Slot 6', 33: 'High Slot 7', 34: 'High Slot 8',
  19: 'Med Slot 1', 20: 'Med Slot 2', 21: 'Med Slot 3', 22: 'Med Slot 4',
  23: 'Med Slot 5', 24: 'Med Slot 6', 25: 'Med Slot 7', 26: 'Med Slot 8',
  11: 'Low Slot 1', 12: 'Low Slot 2', 13: 'Low Slot 3', 14: 'Low Slot 4',
  15: 'Low Slot 5', 16: 'Low Slot 6', 17: 'Low Slot 7', 18: 'Low Slot 8',
  92: 'Rig Slot 1', 93: 'Rig Slot 2', 94: 'Rig Slot 3',
  125: 'Subsystem Slot 1', 126: 'Subsystem Slot 2', 127: 'Subsystem Slot 3', 128: 'Subsystem Slot 4',
  87: 'Drone Bay',
  5: 'Cargo Hold'
}

interface ItemSlot {
  typeId: number
  name: string
  quantity: number
  quantityDropped: number
  quantityDestroyed: number
  price: number
  totalValue: number
  slotName: string
  flag: number
  isDestroyed: boolean
}

interface ItemsBySlot {
  highSlots: ItemSlot[]
  medSlots: ItemSlot[]
  lowSlots: ItemSlot[]
  rigSlots: ItemSlot[]
  subSlots: ItemSlot[]
  droneBay: ItemSlot[]
  cargo: ItemSlot[]
  other: ItemSlot[]
}

import { handleError } from '../../utils/error'

export default defineEventHandler(async (event: H3Event) => {
  try {
    const killmailId = getRouterParam(event, 'id')

    if (!killmailId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Killmail not found'
      })
    }

    const id = parseInt(killmailId, 10)

    // Fetch killmail details using model
    const killmail = await getKillmailDetails(id)

    if (!killmail) {
      throw createError({
        statusCode: 404,
        statusMessage: `Killmail #${id} not found`
      })
    }

    // Fetch all items for this killmail with prices using model
    const itemsWithDetails = await getKillmailItems(id)

    // Organize items by slot
    const itemsBySlot: ItemsBySlot = {
      highSlots: [],
      medSlots: [],
      lowSlots: [],
      rigSlots: [],
      subSlots: [],
      droneBay: [],
      cargo: [],
      other: []
    }

    // Separate destroyed and dropped for fitting wheel
    const fittingWheelDestroyed: ItemsBySlot = {
      highSlots: [],
      medSlots: [],
      lowSlots: [],
      rigSlots: [],
      subSlots: [],
      droneBay: [],
      cargo: [],
      other: []
    }

    const fittingWheelDropped: ItemsBySlot = {
      highSlots: [],
      medSlots: [],
      lowSlots: [],
      rigSlots: [],
      subSlots: [],
      droneBay: [],
      cargo: [],
      other: []
    }

    let totalDestroyed = 0
    let totalDropped = 0
    let totalValue = 0
    let fitValue = 0

    // Define fitting slots (used to calculate fitValue)
    const fittingSlots = [27, 28, 29, 30, 31, 32, 33, 34, 19, 20, 21, 22, 23, 24, 25, 26, 11, 12, 13, 14, 15, 16, 17, 18, 92, 93, 94, 125, 126, 127, 128]

    for (const item of itemsWithDetails) {
      const slotKey = SLOT_MAPPING[item.flag] as keyof ItemsBySlot || 'other'
      const totalQuantity = item.quantityDropped + item.quantityDestroyed
      const itemValue = (item.price || 0) * totalQuantity

      const slotItem: ItemSlot = {
        typeId: item.itemTypeId,
        name: item.name || 'Unknown',
        quantity: totalQuantity,
        quantityDropped: item.quantityDropped,
        quantityDestroyed: item.quantityDestroyed,
        price: item.price || 0,
        totalValue: itemValue,
        slotName: SLOT_NAMES[item.flag] || `Slot ${item.flag}`,
        flag: item.flag,
        isDestroyed: item.quantityDestroyed > 0
      }

      // Add to combined items list
      itemsBySlot[slotKey].push(slotItem)

      // Add to fitting wheel if in fitting slots
      if (fittingSlots.includes(item.flag)) {
        if (item.quantityDestroyed > 0) {
          fittingWheelDestroyed[slotKey].push(slotItem)
          fitValue += (item.price || 0) * item.quantityDestroyed
        }
        if (item.quantityDropped > 0) {
          fittingWheelDropped[slotKey].push(slotItem)
        }
      }

      totalDestroyed += (item.quantityDestroyed * (item.price || 0))
      totalDropped += (item.quantityDropped * (item.price || 0))
      totalValue += itemValue
    }

    // Calculate base stats (before attackers are fetched)
    const shipValue = killmail.victimShipValue || 0
    const itemsValue = totalValue
    const totalKillValue = shipValue + itemsValue

    // Fetch all attackers for this killmail using model
    const attackers = await getKillmailAttackers(id)

    // Calculate stats after attackers are fetched
    const finalBlowAttacker = attackers.find(a => a.finalBlow === 1)
    const topDamageAttacker = attackers[0] || null
    const totalDamage = attackers.reduce((sum, a) => sum + a.damageDone, 0)

    // Fetch sibling killmails (same victim character within 1 hour)
    const killmailDate = new Date(killmail.killmailTime)
    const startDate = new Date(killmailDate.getTime() - 60 * 60 * 1000)
    const endDate = new Date(killmailDate.getTime() + 60 * 60 * 1000)

    // Convert to ClickHouse DateTime format: YYYY-MM-DD HH:MM:SS
    const formatDateTime = (date: Date): string => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      const hours = String(date.getUTCHours()).padStart(2, '0')
      const minutes = String(date.getUTCMinutes()).padStart(2, '0')
      const seconds = String(date.getUTCSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }

    const siblings = await getSiblingKillmails(
      killmail.victimCharacterId || 0,
      formatDateTime(startDate),
      formatDateTime(endDate),
      id,
      20
    )

    // Format data for template
    const victimName = killmail.victimCharacterName || 'Unknown'
    const shipName = killmail.victimShipName || 'Unknown'
    const valueBillion = (totalKillValue / 1_000_000_000).toFixed(2)

    const templateData = {
      killmail: {
        id: killmail.killmailId,
        killmailId: killmail.killmailId,
        hash: killmail.hash,
        time: killmail.killmailTime,
        timeAgo: timeAgo(new Date(killmail.killmailTime)),
        systemName: killmail.solarSystemName,
        systemId: killmail.solarSystemId,
        regionName: killmail.regionName,
        securityStatus: killmail.solarSystemSecurity
      },
      victim: {
        character: killmail.victimCharacterId
          ? {
              id: killmail.victimCharacterId,
              name: killmail.victimCharacterName
            }
          : null,
        corporation: killmail.victimCorporationId
          ? {
              id: killmail.victimCorporationId,
              name: killmail.victimCorporationName,
              ticker: killmail.victimCorporationTicker
            }
          : null,
        alliance: killmail.victimAllianceId
          ? {
              id: killmail.victimAllianceId,
              name: killmail.victimAllianceName,
              ticker: killmail.victimAllianceTicker
            }
          : null,
        ship: {
          typeId: killmail.victimShipTypeId,
          name: killmail.victimShipName,
          groupName: killmail.victimShipGroup
        },
        damageTaken: killmail.victimDamageTaken || 0
      },
      solarSystem: {
        id: killmail.solarSystemId,
        name: killmail.solarSystemName,
        region: killmail.regionName,
        security: killmail.solarSystemSecurity
      },
      attackers: attackers.map(a => ({
        character: a.characterId
          ? {
              id: a.characterId,
              name: a.characterName
            }
          : null,
        corporation: a.corporationId
          ? {
              id: a.corporationId,
              name: a.corporationName,
              ticker: a.corporationTicker
            }
          : null,
        alliance: a.allianceId
          ? {
              id: a.allianceId,
              name: a.allianceName,
              ticker: a.allianceTicker
            }
          : null,
        ship: a.shipTypeId
          ? {
              typeId: a.shipTypeId,
              name: a.shipName
            }
          : null,
        weapon: a.weaponTypeId
          ? {
              typeId: a.weaponTypeId,
              name: a.weaponName
            }
          : null,
        damageDone: a.damageDone,
        finalBlow: a.finalBlow === 1,
        securityStatus: a.securityStatus
      })),
      items: itemsBySlot,
      fittingWheel: {
        destroyed: fittingWheelDestroyed,
        dropped: fittingWheelDropped
      },
      stats: {
        attackerCount: attackers.length,
        totalValue: totalKillValue,
        shipValue,
        itemsValue,
        destroyedValue: totalDestroyed,
        droppedValue: totalDropped,
        fitValue,
        isSolo: attackers.length === 1
      },
      siblings: siblings.map(s => ({
        killmailId: s.killmailId,
        killmailTime: s.killmailTime,
        victimName: s.victimCharacterName,
        victimCharacterId: s.victimCharacterId,
        shipName: s.victimShipName,
        shipTypeId: s.victimShipTypeId,
        totalValue: s.totalValue
      })),
      finalBlow: finalBlowAttacker
        ? {
            character: finalBlowAttacker.characterId
              ? {
                  id: finalBlowAttacker.characterId,
                  name: finalBlowAttacker.characterName
                }
              : null,
            corporation: finalBlowAttacker.corporationId
              ? {
                  id: finalBlowAttacker.corporationId,
                  name: finalBlowAttacker.corporationName,
                  ticker: finalBlowAttacker.corporationTicker
                }
              : null,
            alliance: finalBlowAttacker.allianceId
              ? {
                  id: finalBlowAttacker.allianceId,
                  name: finalBlowAttacker.allianceName,
                  ticker: finalBlowAttacker.allianceTicker
                }
              : null,
            ship: finalBlowAttacker.shipTypeId
              ? {
                  typeId: finalBlowAttacker.shipTypeId,
                  name: finalBlowAttacker.shipName
                }
              : null,
            weapon: finalBlowAttacker.weaponTypeId
              ? {
                  typeId: finalBlowAttacker.weaponTypeId,
                  name: finalBlowAttacker.weaponName
                }
              : null,
            damageDone: finalBlowAttacker.damageDone,
            damagePercent: totalDamage > 0 ? (finalBlowAttacker.damageDone / totalDamage * 100) : 0,
            isFinalBlow: true
          }
        : null,
      topDamage: topDamageAttacker
        ? {
            character: topDamageAttacker.characterId
              ? {
                  id: topDamageAttacker.characterId,
                  name: topDamageAttacker.characterName
                }
              : null,
            corporation: topDamageAttacker.corporationId
              ? {
                  id: topDamageAttacker.corporationId,
                  name: topDamageAttacker.corporationName,
                  ticker: topDamageAttacker.corporationTicker
                }
              : null,
            alliance: topDamageAttacker.allianceId
              ? {
                  id: topDamageAttacker.allianceId,
                  name: topDamageAttacker.allianceName,
                  ticker: topDamageAttacker.allianceTicker
                }
              : null,
            ship: topDamageAttacker.shipTypeId
              ? {
                  typeId: topDamageAttacker.shipTypeId,
                  name: topDamageAttacker.shipName
                }
              : null,
            weapon: topDamageAttacker.weaponTypeId
              ? {
                  typeId: topDamageAttacker.weaponTypeId,
                  name: topDamageAttacker.weaponName
                }
              : null,
            damageDone: topDamageAttacker.damageDone,
            damagePercent: totalDamage > 0 ? (topDamageAttacker.damageDone / totalDamage * 100) : 0
          }
        : null,
      totalDamage
    }

    return render(
      'pages/killmail',
      {
        title: `Killmail #${id} - ${victimName} (${shipName})`,
        description: `${victimName} lost a ${shipName} worth ${valueBillion}B ISK`,
        keywords: 'eve online, killmail, pvp, kill'
      },
      templateData
    )
  } catch (error) {
    return handleError(event, error)
  }
})
