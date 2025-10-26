/**
 * Global kills page - shows latest kills across all of EVE
 */
import type { H3Event } from 'h3'
import { timeAgo } from '../../helpers/time'
import { render } from '../../helpers/templates'
import { getTopBoxStats } from '../../models/top-boxes-frontpage'

export default defineEventHandler(async (event: H3Event) => {
  // Get pagination parameters
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(query.page as string) || 1)
  const perPage = 30
  const offset = (page - 1) * perPage

  // Fetch paginated killmails - latest kills globally
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
    ORDER BY killmail_time DESC
    LIMIT {perPage:UInt32}
    OFFSET {offset:UInt32}
  `, { perPage, offset })

  // Get total count for pagination
  const countResult = await database.queryOne<{ total: number }>(`
    SELECT count() as total
    FROM entity_killlist
  `)

  const totalKillmails = countResult?.total || 0
  const totalPages = Math.ceil(totalKillmails / perPage)

  // Format killmail data for template
  const recentKillmails = killmails.map(km => ({
    killmail_id: km.killmail_id,
    killmail_time: timeAgo(new Date(km.killmail_time)),
    isLoss: false, // Global kills page shows all kills, not from any particular perspective
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

  // Fetch top 10 stats
  const top10Stats = await getTopBoxStats()

  // Transform top10Stats to add imageType and link properties
  const top10 = {
    characters: top10Stats.characters.map(c => ({
      ...c,
      imageType: 'character',
      imageId: c.id,
      link: `/character/${c.id}`
    })),
    corporations: top10Stats.corporations.map(c => ({
      ...c,
      imageType: 'corporation',
      imageId: c.id,
      link: `/corporation/${c.id}`
    })),
    alliances: top10Stats.alliances.map(a => ({
      ...a,
      imageType: 'alliance',
      imageId: a.id,
      link: `/alliance/${a.id}`
    })),
    systems: top10Stats.systems.map(s => ({
      ...s,
      imageType: 'system',
      imageId: s.id,
      link: `/system/${s.id}`
    })),
    regions: top10Stats.regions.map(r => ({
      ...r,
      imageType: 'region',
      imageId: r.id,
      link: `/region/${r.id}`
    }))
  }

  // Render the template
  return render(
    'pages/kills',
    {
      title: 'Latest Kills',
      description: 'Browse the latest killmails from across EVE Online',
      keywords: 'eve online, killmail, pvp, kills'
    },
    {
      title: 'Latest Kills',
      recentKillmails,
      pagination,
      topCharactersFormatted: top10.characters,
      topCorporationsFormatted: top10.corporations,
      topAlliancesFormatted: top10.alliances,
      topSystemsFormatted: top10.systems,
      topRegionsFormatted: top10.regions
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
