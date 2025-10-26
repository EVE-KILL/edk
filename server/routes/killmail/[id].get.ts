/**
 * Killmail detail page
 * Shows complete killmail information including victim, attackers, items, and stats
 * Layout: 65% left (items/fitting wheel), 35% right (victim/attackers)
 */
import type { H3Event } from 'h3'
import { timeAgo } from '../../helpers/time'
import { render } from '../../helpers/templates'

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

export default defineEventHandler(async (event: H3Event) => {
  const killmailId = getRouterParam(event, 'id')

  if (!killmailId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Killmail not found'
    })
  }

  const id = parseInt(killmailId, 10)

  // Fetch killmail from both entity_killlist and killmails tables for complete data
  const killmail = await database.queryOne<any>(`
    SELECT
      k.killmailId as killmail_id,
      k.killmailTime as killmail_time,
      k.victimDamageTaken as victim_damage_taken,
      k.hash as hash,
      el.victim_character_id,
      el.victim_character_name,
      el.victim_corporation_id,
      el.victim_corporation_name,
      el.victim_corporation_ticker,
      el.victim_alliance_id,
      el.victim_alliance_name,
      el.victim_alliance_ticker,
      el.victim_ship_type_id,
      el.victim_ship_name,
      el.victim_ship_group,
      el.victim_ship_value,
      el.solar_system_id,
      el.solar_system_name,
      el.region_name,
      el.solar_system_security
    FROM edk.killmails k
    FINAL
    LEFT JOIN entity_killlist el ON k.killmailId = el.killmail_id
    WHERE k.killmailId = {id:UInt32}
    LIMIT 1
  `, { id })

  if (!killmail) {
    throw createError({
      statusCode: 404,
      statusMessage: `Killmail #${id} not found`
    })
  }

  // Fetch all items for this killmail with details
  const itemsWithDetails = await database.query<{
    itemTypeId: number
    name: string
    quantityDropped: number
    quantityDestroyed: number
    flag: number
    price: number
  }>(`
    SELECT
      i.itemTypeId,
      t.name,
      i.quantityDropped,
      i.quantityDestroyed,
      i.flag,
      coalesce(p.average_price, 0) as price
    FROM edk.items i
    FINAL
    LEFT JOIN edk.types t ON i.itemTypeId = t.typeId
    LEFT JOIN (
      SELECT
        type_id,
        argMax(average_price, version) as average_price
      FROM edk.prices
      FINAL
      WHERE region_id = 10000002
      AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
      GROUP BY type_id
    ) p ON i.itemTypeId = p.type_id
    WHERE i.killmailId = {id:UInt32}
    AND i.itemTypeId IS NOT NULL
  `, { id })

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
  const shipValue = killmail.victim_ship_value || 0
  const itemsValue = totalValue
  const totalKillValue = shipValue + itemsValue

  // Fetch all attackers for this killmail to find final blow and top damage
  const attackers = await database.query<{
    character_id: number
    character_name: string
    corporation_id: number
    corporation_name: string
    corporation_ticker: string
    alliance_id: number | null
    alliance_name: string
    alliance_ticker: string
    damage_done: number
    final_blow: number
    security_status: number | null
    ship_type_id: number | null
    ship_name: string | null
    weapon_type_id: number | null
    weapon_name: string | null
  }>(`
    SELECT
      a.characterId as character_id,
      coalesce(c.name, nc.name, 'Unknown') as character_name,
      a.corporationId as corporation_id,
      coalesce(corp.name, npc_corp.name, 'Unknown') as corporation_name,
      coalesce(corp.ticker, npc_corp.tickerName, '???') as corporation_ticker,
      a.allianceId as alliance_id,
      coalesce(a_alliance.name, 'Unknown') as alliance_name,
      coalesce(a_alliance.ticker, '???') as alliance_ticker,
      a.damageDone as damage_done,
      a.finalBlow as final_blow,
      a.securityStatus as security_status,
      a.shipTypeId as ship_type_id,
      coalesce(t.name, 'Unknown') as ship_name,
      a.weaponTypeId as weapon_type_id,
      coalesce(w.name, 'Unknown') as weapon_name
    FROM edk.attackers a
    FINAL
    LEFT JOIN edk.characters c FINAL ON a.characterId = c.character_id
    LEFT JOIN edk.npcCharacters nc FINAL ON a.characterId = nc.characterId
    LEFT JOIN edk.corporations corp FINAL ON a.corporationId = corp.corporation_id
    LEFT JOIN edk.npcCorporations npc_corp FINAL ON a.corporationId = npc_corp.corporationId
    LEFT JOIN edk.alliances a_alliance FINAL ON a.allianceId = a_alliance.alliance_id
    LEFT JOIN edk.types t FINAL ON a.shipTypeId = t.typeId
    LEFT JOIN edk.types w FINAL ON a.weaponTypeId = w.typeId
    WHERE a.killmailId = {id:UInt32}
    ORDER BY a.damageDone DESC
  `, { id })

  // Calculate stats after attackers are fetched
  const finalBlowAttacker = attackers.find(a => a.final_blow === 1)
  const topDamageAttacker = attackers[0] || null
  const totalDamage = attackers.reduce((sum, a) => sum + a.damage_done, 0)

  // Fetch sibling killmails (same victim character within 1 hour)
  const killmailDate = new Date(killmail.killmail_time)
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

  const siblings = await database.query<{
    killmail_id: number
    killmail_time: string
    victim_character_name: string
    victim_character_id: number | null
    victim_ship_name: string
    victim_ship_type_id: number
    total_value: number
  }>(`
    SELECT
      killmail_id,
      killmail_time,
      victim_character_name,
      victim_character_id,
      victim_ship_name,
      victim_ship_type_id,
      total_value
    FROM entity_killlist
    WHERE victim_character_id = {victimCharId:UInt32}
    AND killmail_time >= {startTime:DateTime}
    AND killmail_time <= {endTime:DateTime}
    AND killmail_id != {id:UInt32}
    ORDER BY killmail_time DESC
    LIMIT 20
  `, {
    victimCharId: killmail.victim_character_id,
    startTime: formatDateTime(startDate),
    endTime: formatDateTime(endDate),
    id
  })

  // Format data for template
  const victimName = killmail.victim_character_name || 'Unknown'
  const shipName = killmail.victim_ship_name || 'Unknown'
  const valueBillion = (totalKillValue / 1_000_000_000).toFixed(2)

  const templateData = {
    killmail: {
      id: killmail.killmail_id,
      killmailId: killmail.killmail_id,
      hash: killmail.hash,
      time: killmail.killmail_time,
      timeAgo: timeAgo(new Date(killmail.killmail_time)),
      systemName: killmail.solar_system_name,
      systemId: killmail.solar_system_id,
      regionName: killmail.region_name,
      securityStatus: killmail.solar_system_security
    },
    victim: {
      character: killmail.victim_character_id ? {
        id: killmail.victim_character_id,
        name: killmail.victim_character_name
      } : null,
      corporation: killmail.victim_corporation_id ? {
        id: killmail.victim_corporation_id,
        name: killmail.victim_corporation_name,
        ticker: killmail.victim_corporation_ticker
      } : null,
      alliance: killmail.victim_alliance_id ? {
        id: killmail.victim_alliance_id,
        name: killmail.victim_alliance_name,
        ticker: killmail.victim_alliance_ticker
      } : null,
      ship: {
        typeId: killmail.victim_ship_type_id,
        name: killmail.victim_ship_name,
        groupName: killmail.victim_ship_group
      },
      damageTaken: killmail.victim_damage_taken || 0
    },
    solarSystem: {
      id: killmail.solar_system_id,
      name: killmail.solar_system_name,
      region: killmail.region_name,
      security: killmail.solar_system_security
    },
    attackers: attackers.map(a => ({
      character: a.character_id ? {
        id: a.character_id,
        name: a.character_name
      } : null,
      corporation: a.corporation_id ? {
        id: a.corporation_id,
        name: a.corporation_name,
        ticker: a.corporation_ticker
      } : null,
      alliance: a.alliance_id ? {
        id: a.alliance_id,
        name: a.alliance_name,
        ticker: a.alliance_ticker
      } : null,
      ship: a.ship_type_id ? {
        typeId: a.ship_type_id,
        name: a.ship_name
      } : null,
      weapon: a.weapon_type_id ? {
        typeId: a.weapon_type_id,
        name: a.weapon_name
      } : null,
      damageDone: a.damage_done,
      finalBlow: a.final_blow === 1,
      securityStatus: a.security_status
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
      killmailId: s.killmail_id,
      killmailTime: s.killmail_time,
      victimName: s.victim_character_name,
      victimCharacterId: s.victim_character_id,
      shipName: s.victim_ship_name,
      shipTypeId: s.victim_ship_type_id,
      totalValue: s.total_value
    })),
    finalBlow: finalBlowAttacker ? {
      character: finalBlowAttacker.character_id ? {
        id: finalBlowAttacker.character_id,
        name: finalBlowAttacker.character_name
      } : null,
      corporation: finalBlowAttacker.corporation_id ? {
        id: finalBlowAttacker.corporation_id,
        name: finalBlowAttacker.corporation_name,
        ticker: finalBlowAttacker.corporation_ticker
      } : null,
      alliance: finalBlowAttacker.alliance_id ? {
        id: finalBlowAttacker.alliance_id,
        name: finalBlowAttacker.alliance_name,
        ticker: finalBlowAttacker.alliance_ticker
      } : null,
      ship: finalBlowAttacker.ship_type_id ? {
        typeId: finalBlowAttacker.ship_type_id,
        name: finalBlowAttacker.ship_name
      } : null,
      weapon: finalBlowAttacker.weapon_type_id ? {
        typeId: finalBlowAttacker.weapon_type_id,
        name: finalBlowAttacker.weapon_name
      } : null,
      damageDone: finalBlowAttacker.damage_done,
      damagePercent: totalDamage > 0 ? (finalBlowAttacker.damage_done / totalDamage * 100) : 0,
      isFinalBlow: true
    } : null,
    topDamage: topDamageAttacker ? {
      character: topDamageAttacker.character_id ? {
        id: topDamageAttacker.character_id,
        name: topDamageAttacker.character_name
      } : null,
      corporation: topDamageAttacker.corporation_id ? {
        id: topDamageAttacker.corporation_id,
        name: topDamageAttacker.corporation_name,
        ticker: topDamageAttacker.corporation_ticker
      } : null,
      alliance: topDamageAttacker.alliance_id ? {
        id: topDamageAttacker.alliance_id,
        name: topDamageAttacker.alliance_name,
        ticker: topDamageAttacker.alliance_ticker
      } : null,
      ship: topDamageAttacker.ship_type_id ? {
        typeId: topDamageAttacker.ship_type_id,
        name: topDamageAttacker.ship_name
      } : null,
      weapon: topDamageAttacker.weapon_type_id ? {
        typeId: topDamageAttacker.weapon_type_id,
        name: topDamageAttacker.weapon_name
      } : null,
      damageDone: topDamageAttacker.damage_done,
      damagePercent: totalDamage > 0 ? (topDamageAttacker.damage_done / totalDamage * 100) : 0
    } : null,
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
})
