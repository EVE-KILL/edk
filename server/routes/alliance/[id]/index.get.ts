/**
 * Alliance entity page - dashboard
 */
import type { H3Event } from 'h3'
import { timeAgo } from '../../../helpers/time'
import {
  getAllianceStats,
  getTopSystemsByAlliance,
  getTopRegionsByAlliance,
  getTopCorporationsKilledByAlliance,
  getTopAlliancesKilledByAlliance,
  getMostValuableKillsByAllianceNew
} from '../../../models/entities'

export default defineEventHandler(async (event: H3Event) => {
  const allianceId = Number.parseInt(getRouterParam(event, 'id') || '0')

  if (!allianceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid alliance ID'
    })
  }

  // Fetch alliance basic info
  const allianceData = await database.queryOne<{
    name: string
    ticker: string
  }>(`
    SELECT
      a.name as name,
      a.ticker as ticker
    FROM alliances a
    WHERE a.alliance_id = {allianceId:UInt32}
    LIMIT 1
  `, { allianceId })

  if (!allianceData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Alliance not found'
    })
  }

  // Fetch all entity data in parallel
  const [stats, topSystems, topRegions, topCorps, topAlliances, mostValuable] = await Promise.all([
    getAllianceStats(allianceId),
    getTopSystemsByAlliance(allianceId),
    getTopRegionsByAlliance(allianceId),
    getTopCorporationsKilledByAlliance(allianceId),
    getTopAlliancesKilledByAlliance(allianceId),
    getMostValuableKillsByAllianceNew(allianceId)
  ])

  // Get pagination parameters
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(query.page as string) || 1)
  const perPage = 30
  const offset = (page - 1) * perPage

  // Fetch paginated killmails
  const killmails = await database.query<{
    killmail_id: number
    killmail_time: string
    victim_character_id: number | null
    victim_character_name: string
    victim_corporation_id: number
    victim_corporation_name: string
    victim_corporation_ticker: string
    victim_alliance_id: number | null
    victim_alliance_name: string
    victim_alliance_ticker: string
    victim_ship_name: string
    victim_ship_type_id: number
    attacker_character_id: number | null
    attacker_character_name: string
    attacker_corporation_id: number | null
    attacker_corporation_name: string
    attacker_corporation_ticker: string
    attacker_alliance_id: number | null
    attacker_alliance_name: string
    attacker_alliance_ticker: string
    solar_system_name: string
    region_name: string
    total_value: number
    attacker_count: number
    is_solo: number
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
      victim_ship_name,
      victim_ship_type_id,
      attacker_character_id,
      attacker_character_name,
      attacker_corporation_id,
      attacker_corporation_name,
      attacker_corporation_ticker,
      attacker_alliance_id,
      attacker_alliance_name,
      attacker_alliance_ticker,
      solar_system_name,
      region_name,
      total_value,
      attacker_count,
      is_solo
    FROM entity_killlist
    WHERE (attacker_alliance_id = {allianceId:UInt32} OR victim_alliance_id = {allianceId:UInt32})
    ORDER BY killmail_time DESC
    LIMIT {perPage:UInt32}
    OFFSET {offset:UInt32}
  `, { allianceId, perPage, offset })

  // Get total count for pagination
  const countResult = await database.queryOne<{ total: number }>(`
    SELECT count() as total
    FROM entity_killlist
    WHERE (attacker_alliance_id = {allianceId:UInt32} OR victim_alliance_id = {allianceId:UInt32})
  `, { allianceId })

  const totalKillmails = countResult?.total || 0
  const totalPages = Math.ceil(totalKillmails / perPage)

  // Format killmail data for template
  const recentKillmails = killmails.map(km => ({
    killmail_id: km.killmail_id,
    killmail_time: timeAgo(new Date(km.killmail_time)),
    isLoss: km.victim_alliance_id === allianceId,
    victim: {
      character: {
        id: km.victim_character_id,
        name: km.victim_character_name
      },
      corporation: {
        id: km.victim_corporation_id,
        name: km.victim_corporation_name,
        ticker: km.victim_corporation_ticker
      },
      alliance: km.victim_alliance_id ? {
        id: km.victim_alliance_id,
        name: km.victim_alliance_name,
        ticker: km.victim_alliance_ticker
      } : null,
      ship: {
        type_id: km.victim_ship_type_id,
        name: km.victim_ship_name
      }
    },
    solar_system: {
      name: km.solar_system_name,
      region: km.region_name
    },
    attackers: [
      {
        character: {
          id: km.attacker_character_id,
          name: km.attacker_character_name
        },
        corporation: {
          id: km.attacker_corporation_id,
          name: km.attacker_corporation_name,
          ticker: km.attacker_corporation_ticker
        },
        alliance: km.attacker_alliance_id ? {
          id: km.attacker_alliance_id,
          name: km.attacker_alliance_name,
          ticker: km.attacker_alliance_ticker
        } : null
      }
    ],
    total_value: km.total_value,
    attacker_count: km.attacker_count,
    is_solo: km.is_solo
  }))

  // Entity header data
  const entityData = {
    entityId: allianceId,
    entityType: 'alliance',
    name: allianceData.name,
    type: 'alliance',
    stats,
    baseUrl: `/alliance/${allianceId}`,
    entityBaseUrl: `/alliance/${allianceId}`,
    currentTab: 'dashboard',
    parent: null,
    grandparent: null
  }

  // Top boxes - for alliances we show systems, regions, corporations, alliances
  const top10 = {
    characters: [],
    systems: topSystems.map(s => ({
      ...s,
      imageType: 'system',
      imageId: s.id,
      link: `/system/${s.id}`
    })),
    regions: topRegions.map(r => ({
      ...r,
      imageType: 'region',
      imageId: r.id,
      link: `/region/${r.id}`
    })),
    corporations: topCorps.map(c => ({
      ...c,
      imageType: 'corporation',
      imageId: c.id,
      link: `/corporation/${c.id}`
    })),
    alliances: topAlliances.map(a => ({
      ...a,
      imageType: 'alliance',
      imageId: a.id,
      link: `/alliance/${a.id}`
    }))
  }

  // Pagination
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

  // Transform most valuable kills to template format
  const transformedMostValuable = mostValuable.map(kill => ({
    killmail_id: kill.killmail_id,
    killmail_time: kill.killmail_time,
    total_value: kill.total_value,
    victim: {
      ship: {
        type_id: kill.victim_ship_type_id,
        name: kill.victim_ship_name
      },
      character: {
        id: null,
        name: kill.victim_character_name
      },
      corporation: {
        id: null,
        name: kill.victim_corporation_name,
        ticker: kill.victim_corporation_ticker
      },
      alliance: kill.victim_alliance_name ? {
        id: null,
        name: kill.victim_alliance_name,
        ticker: kill.victim_alliance_ticker
      } : null
    }
  }))

  // Render the template
  return render(
    'pages/alliance-detail',
    {
      title: `${allianceData.name} - Alliance`,
      description: `Alliance statistics for ${allianceData.name}`,
      keywords: 'eve online, alliance, killmail, pvp'
    },
    {
      ...entityData,
      top10Stats: top10,
      mostValuableKills: transformedMostValuable,
      recentKillmails,
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
