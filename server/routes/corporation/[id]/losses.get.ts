import type { H3Event } from 'h3'
import { timeAgo } from '../../../helpers/time'
import { getCorporationStats } from '../../../models/entities'

export default defineEventHandler(async (event: H3Event) => {
  const corporationId = Number.parseInt(getRouterParam(event, 'id') || '0')

  if (!corporationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid corporation ID'
    })
  }

  // Fetch corporation basic info with alliance
  const corporationData = await database.queryOne<{
    name: string
    ticker: string
    alliance_id: number | null
    alliance_name: string | null
    alliance_ticker: string | null
  }>(`
    SELECT
      c.name as name,
      c.ticker as ticker,
      c.alliance_id as alliance_id,
      alliance.name as alliance_name,
      alliance.ticker as alliance_ticker
    FROM corporations c
    LEFT JOIN alliances alliance ON c.alliance_id = alliance.alliance_id
    WHERE c.corporation_id = {corporationId:UInt32}
    LIMIT 1
  `, { corporationId })

  if (!corporationData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Corporation not found'
    })
  }

  // Get corporation stats
  const stats = await getCorporationStats(corporationId)

  // Get pagination parameters
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(query.page as string) || 1)
  const perPage = 30
  const offset = (page - 1) * perPage

  // Fetch killmails where corporation was victim (losses)
  const killmailsData = await database.query<{
    killmail_id: number
    killmail_time: string
    victim_character_id: number | null
    victim_character_name: string
    victim_corporation_id: number
    victim_corporation_name: string
    victim_corporation_ticker: string
    victim_alliance_id: number | null
    victim_alliance_name: string | null
    victim_alliance_ticker: string | null
    victim_ship_type_id: number
    victim_ship_name: string
    victim_ship_group: string
    attacker_character_id: number
    attacker_character_name: string
    attacker_corporation_id: number
    attacker_corporation_name: string
    attacker_corporation_ticker: string
    attacker_alliance_id: number | null
    attacker_alliance_name: string | null
    attacker_alliance_ticker: string | null
    solar_system_id: number
    solar_system_name: string
    region_name: string
    total_value: number
    attacker_count: number
  }>(`
    SELECT
      killmail_id,
      killmail_time,
      victim_character_id,
      victim_character_name,
      victim_corporation_id,
      victim_corporation_name,
      victim_corporation_ticker,
      victim_alliance_id,
      victim_alliance_name,
      victim_alliance_ticker,
      victim_ship_type_id,
      victim_ship_name,
      victim_ship_group,
      attacker_character_id,
      attacker_character_name,
      attacker_corporation_id,
      attacker_corporation_name,
      attacker_corporation_ticker,
      attacker_alliance_id,
      attacker_alliance_name,
      attacker_alliance_ticker,
      solar_system_id,
      solar_system_name,
      region_name,
      total_value,
      attacker_count
    FROM entity_killlist
    WHERE victim_corporation_id = {corporationId:UInt32}
    ORDER BY killmail_time DESC
    LIMIT {perPage:UInt32} OFFSET {offset:UInt32}
  `, { corporationId, perPage, offset })

  // Get total count
  const countResult = await database.queryOne<{ count: number }>(`
    SELECT count() as count
    FROM entity_killlist
    WHERE victim_corporation_id = {corporationId:UInt32}
  `, { corporationId })
  const totalKillmails = countResult?.count || 0

  // Calculate pagination
  const totalPages = Math.ceil(totalKillmails / perPage)
  const pagination = {
    currentPage: page,
    totalPages,
    pages: generatePageNumbers(page, totalPages),
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page - 1,
    nextPage: page + 1,
    showFirst: page > 3 && totalPages > 5,
    showLast: page < totalPages - 2 && totalPages > 5
  }

  // Transform killmail data to match component expectations
  const killmails = killmailsData.map(km => ({
    killmail_id: km.killmail_id,
    victim: {
      ship: {
        type_id: km.victim_ship_type_id,
        name: km.victim_ship_name || 'Unknown Ship',
        group: km.victim_ship_group || 'Unknown'
      },
      character: {
        id: km.victim_character_id,
        name: km.victim_character_name || 'Unknown'
      },
      corporation: {
        id: km.victim_corporation_id,
        name: km.victim_corporation_name || 'Unknown Corp',
        ticker: km.victim_corporation_ticker || '???'
      },
      alliance: km.victim_alliance_id ? {
        id: km.victim_alliance_id,
        name: km.victim_alliance_name || 'Unknown Alliance',
        ticker: km.victim_alliance_ticker || '???'
      } : undefined
    },
    attackers: [{
      character: {
        id: km.attacker_character_id || 0,
        name: km.attacker_character_name || 'Unknown'
      },
      corporation: {
        id: km.attacker_corporation_id || 0,
        name: km.attacker_corporation_name || 'Unknown Corp',
        ticker: km.attacker_corporation_ticker || '???'
      },
      alliance: km.attacker_alliance_id ? {
        id: km.attacker_alliance_id,
        name: km.attacker_alliance_name || 'Unknown Alliance',
        ticker: km.attacker_alliance_ticker || '???'
      } : undefined
    }],
    solar_system: {
      id: km.solar_system_id,
      name: km.solar_system_name || 'Unknown System',
      region: km.region_name || 'Unknown Region'
    },
    total_value: km.total_value || 0,
    attacker_count: km.attacker_count || 0,
    killmail_time: timeAgo(new Date(km.killmail_time))
  }))

  // Entity header data
  const entityData = {
    entityId: corporationId,
    entityType: 'corporation',
    name: corporationData.name,
    type: 'corporation',
    stats,
    baseUrl: `/corporation/${corporationId}/losses`,
    entityBaseUrl: `/corporation/${corporationId}`,
    currentTab: 'losses',
    parent: corporationData.alliance_id ? {
      id: corporationData.alliance_id,
      name: corporationData.alliance_name,
      ticker: corporationData.alliance_ticker
    } : null,
    grandparent: null
  }

  // Render the template
  return render(
    'pages/corporation-losses',
    {
      title: `${corporationData.name} - Losses`,
      description: `Losses by ${corporationData.name}`,
      keywords: 'eve online, corporation, killmail, losses, pvp'
    },
    {
      ...entityData,
      killmails,
      pagination
    }
  )
})

// Helper function to generate page numbers
function generatePageNumbers(currentPage: number, totalPages: number): number[] {
  const pages: number[] = []
  const maxVisible = 5

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let endPage = Math.min(totalPages, startPage + maxVisible - 1)

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1)
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  return pages
}
