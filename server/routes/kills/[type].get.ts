/**
 * Filtered kills page - shows kills filtered by type (solo, big, nullsec, etc.)
 */
import type { H3Event } from 'h3'
import { timeAgo } from '../../helpers/time'
import { render } from '../../helpers/templates'

// Ship group IDs for filtering
const SHIP_GROUPS = {
  // Big kills - Capitals, Supercarriers, Titans, Freighters, Jump Freighters, Rorquals
  big: [547, 485, 513, 902, 941, 30, 659],
  // Frigates
  frigates: [324, 893, 25, 831, 237],
  // Destroyers
  destroyers: [420, 541],
  // Cruisers
  cruisers: [906, 26, 833, 358, 894, 832, 963],
  // Battlecruisers
  battlecruisers: [419, 540],
  // Battleships
  battleships: [27, 898, 900],
  // Capitals
  capitals: [547, 485],
  // Freighters
  freighters: [513, 902],
  // Supercarriers
  supercarriers: [659],
  // Titans
  titans: [30],
  // Citadels
  citadels: [1657, 1406, 1404, 1408, 2017, 2016],
  // T1 ships
  t1: [419, 27, 29, 547, 26, 420, 25, 28, 941, 463, 237, 31],
  // T2 ships
  t2: [324, 898, 906, 540, 830, 893, 543, 541, 833, 358, 894, 831, 902, 832, 900, 834, 380],
  // T3 ships
  t3: [963, 1305]
}

// Valid kill types
const VALID_KILL_TYPES = [
  'latest',
  'big',
  'solo',
  'npc',
  'highsec',
  'lowsec',
  'nullsec',
  'w-space',
  'abyssal',
  'pochven',
  '5b',
  '10b',
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
  't3'
] as const

type KillType = typeof VALID_KILL_TYPES[number]

interface KilllistFilters {
  spaceType?: string
  isSolo?: boolean
  isBig?: boolean
  isNpc?: boolean
  minValue?: number
  shipGroupIds?: number[]
  minSecurityStatus?: number
  maxSecurityStatus?: number
  regionId?: number
  regionIdMin?: number
  regionIdMax?: number
}

/**
 * Build filters based on the kill type
 * Uses pre-computed columns in entity_killlist for maximum performance
 */
function buildFiltersForType(type: KillType): KilllistFilters {
  const filters: KilllistFilters = {}

  switch (type) {
    case 'latest':
      // No special filters - just latest kills
      break

    case 'big':
      filters.isBig = true
      break

    case 'solo':
      filters.isSolo = true
      break

    case 'npc':
      filters.isNpc = true
      break

    case 'highsec':
      filters.minSecurityStatus = 0.45
      break

    case 'lowsec':
      filters.minSecurityStatus = 0.0
      filters.maxSecurityStatus = 0.45
      break

    case 'nullsec':
      filters.maxSecurityStatus = 0.0
      break

    case 'w-space':
      filters.regionIdMin = 11000001
      filters.regionIdMax = 11000033
      break

    case 'abyssal':
      filters.regionIdMin = 12000000
      filters.regionIdMax = 13000000
      break

    case 'pochven':
      filters.regionId = 10000070
      break

    case '5b':
      filters.minValue = 5_000_000_000
      break

    case '10b':
      filters.minValue = 10_000_000_000
      break

    case 'frigates':
      filters.shipGroupIds = SHIP_GROUPS.frigates
      break

    case 'destroyers':
      filters.shipGroupIds = SHIP_GROUPS.destroyers
      break

    case 'cruisers':
      filters.shipGroupIds = SHIP_GROUPS.cruisers
      break

    case 'battlecruisers':
      filters.shipGroupIds = SHIP_GROUPS.battlecruisers
      break

    case 'battleships':
      filters.shipGroupIds = SHIP_GROUPS.battleships
      break

    case 'capitals':
      filters.shipGroupIds = SHIP_GROUPS.capitals
      break

    case 'supercarriers':
      filters.shipGroupIds = SHIP_GROUPS.supercarriers
      break

    case 'titans':
      filters.shipGroupIds = SHIP_GROUPS.titans
      break

    case 'freighters':
      filters.shipGroupIds = SHIP_GROUPS.freighters
      break

    case 'citadels':
      filters.shipGroupIds = SHIP_GROUPS.citadels
      break

    case 'structures':
      filters.shipGroupIds = SHIP_GROUPS.citadels
      break

    case 't1':
      filters.shipGroupIds = SHIP_GROUPS.t1
      break

    case 't2':
      filters.shipGroupIds = SHIP_GROUPS.t2
      break

    case 't3':
      filters.shipGroupIds = SHIP_GROUPS.t3
      break
  }

  return filters
}

/**
 * Get display title for the kill type
 */
function getTitleForType(type: KillType): string {
  const titles: Record<KillType, string> = {
    latest: 'Latest Kills',
    big: 'Big Kills',
    solo: 'Solo Kills',
    npc: 'NPC Kills',
    highsec: 'High-Sec Kills',
    lowsec: 'Low-Sec Kills',
    nullsec: 'Null-Sec Kills',
    'w-space': 'W-Space Kills',
    abyssal: 'Abyssal Kills',
    pochven: 'Pochven Kills',
    '5b': '5B+ Kills',
    '10b': '10B+ Kills',
    frigates: 'Frigate Kills',
    destroyers: 'Destroyer Kills',
    cruisers: 'Cruiser Kills',
    battlecruisers: 'Battlecruiser Kills',
    battleships: 'Battleship Kills',
    capitals: 'Capital Kills',
    supercarriers: 'Supercarrier Kills',
    titans: 'Titan Kills',
    freighters: 'Freighter Kills',
    citadels: 'Citadel Kills',
    structures: 'Structure Kills',
    t1: 'T1 Ship Kills',
    t2: 'T2 Ship Kills',
    t3: 'T3 Ship Kills'
  }

  return titles[type] || 'Kills'
}

/**
 * Build WHERE clause based on filters
 * Constructs conditions using actual database fields
 */
function buildWhereClause(filters: KilllistFilters): { clause: string; params: Record<string, any> } {
  const conditions: string[] = []
  const params: Record<string, any> = {}

  if (filters.isSolo) {
    conditions.push('is_solo = 1')
  }

  if (filters.isBig) {
    // Big kills - victim in specific ship groups
    params.bigShipGroupIds = [547, 485, 513, 902, 941, 30, 659]
    conditions.push(`victim_ship_group_id IN {bigShipGroupIds:Array(UInt32)}`)
  }

  if (filters.minSecurityStatus !== undefined) {
    params.minSecurityStatus = filters.minSecurityStatus
    conditions.push(`solar_system_security >= {minSecurityStatus:Float32}`)
  }

  if (filters.maxSecurityStatus !== undefined) {
    params.maxSecurityStatus = filters.maxSecurityStatus
    // For nullsec, also exclude w-space region IDs (11000001-11000033)
    if (filters.maxSecurityStatus === 0.0) {
      conditions.push(`(solar_system_security < {maxSecurityStatus:Float32} AND (region_id < 11000001 OR region_id > 11000033))`)
    } else {
      conditions.push(`solar_system_security < {maxSecurityStatus:Float32}`)
    }
  }

  if (filters.regionId !== undefined) {
    params.regionId = filters.regionId
    conditions.push(`region_id = {regionId:UInt32}`)
  }

  if (filters.regionIdMin !== undefined && filters.regionIdMax !== undefined) {
    params.regionIdMin = filters.regionIdMin
    params.regionIdMax = filters.regionIdMax
    conditions.push(`(region_id >= {regionIdMin:UInt32} AND region_id <= {regionIdMax:UInt32})`)
  }

  if (filters.isNpc) {
    conditions.push('is_npc_kill = 1')
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    params.shipGroupIds = filters.shipGroupIds
    conditions.push(`victim_ship_group_id IN {shipGroupIds:Array(UInt32)}`)
  }

  // Value filter - goes in WHERE clause
  if (filters.minValue !== undefined) {
    params.minValue = filters.minValue
    conditions.push(`total_value >= {minValue:UInt64}`)
  }

  const clause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  return { clause, params }
}

/**
 * Convert WHERE clause to AND conditions for use in nested queries
 */
function whereClauseToAndConditions(whereClause: string): string {
  if (!whereClause) return ''
  return whereClause.replace(/^WHERE /, '')
}

export default defineEventHandler(async (event: H3Event) => {
  const type = getRouterParam(event, 'type') as string | undefined

  // Validate the type
  if (!type || !VALID_KILL_TYPES.includes(type as KillType)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid kill type'
    })
  }

  const killType = type as KillType

  // Get pagination parameters
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(query.page as string) || 1)
  const perPage = 30
  const offset = (page - 1) * perPage

  // Build filters based on the type
  const filters = buildFiltersForType(killType)
  const whereClause = buildWhereClause(filters)

  // Build query params - merge whereClause params with pagination params
  const queryParams: any = { perPage, offset, ...whereClause.params }

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
    ${whereClause.clause}
    ORDER BY killmail_time DESC
    LIMIT {perPage:UInt32}
    OFFSET {offset:UInt32}
  `, queryParams)

  // Get total count for pagination
  const countResult = await database.queryOne<{ total: number }>(`
    SELECT count() as total
    FROM entity_killlist
    ${whereClause.clause}
  `, queryParams)

  const totalKillmails = countResult?.total || 0
  const totalPages = Math.ceil(totalKillmails / perPage)

  // Format killmail data for template
  const recentKillmails = killmails.map(km => ({
    killmail_id: km.killmail_id,
    killmail_time: timeAgo(new Date(km.killmail_time)),
    isLoss: false, // Filtered kills page shows all kills, not from any particular perspective
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

  // Get Top Systems
  const topSystems = await database.query<{
    solar_system_id: number
    solar_system_name: string
    kills: number
  }>(`
    SELECT
      solar_system_id,
      solar_system_name,
      count() as kills
    FROM entity_killlist
    WHERE killmail_time >= now() - INTERVAL 30 DAY
      ${whereClauseToAndConditions(whereClause.clause) ? `AND ${whereClauseToAndConditions(whereClause.clause)}` : ''}
    GROUP BY solar_system_id, solar_system_name
    ORDER BY kills DESC
    LIMIT 10
  `, queryParams)

  // Get Top Regions
  const topRegions = await database.query<{
    region_id: number
    region_name: string
    kills: number
  }>(`
    SELECT
      region_id,
      region_name,
      count() as kills
    FROM entity_killlist
    WHERE killmail_time >= now() - INTERVAL 30 DAY
      ${whereClauseToAndConditions(whereClause.clause) ? `AND ${whereClauseToAndConditions(whereClause.clause)}` : ''}
    GROUP BY region_id, region_name
    ORDER BY kills DESC
    LIMIT 10
  `, queryParams)

  // Get Top Characters (by final blow)
  // For top boxes, we want to show stats from ALL kills in this category
  // Build the same WHERE conditions but explicitly
  const topCharacters = await database.query<{
    attacker_character_id: number
    attacker_character_name: string
    kills: number
  }>(`
    SELECT
      attacker_character_id,
      attacker_character_name,
      count() as kills
    FROM entity_killlist
    WHERE killmail_time >= now() - INTERVAL 30 DAY
      AND attacker_character_name != ''
      ${whereClauseToAndConditions(whereClause.clause) ? `AND ${whereClauseToAndConditions(whereClause.clause)}` : ''}
    GROUP BY attacker_character_id, attacker_character_name
    ORDER BY kills DESC
    LIMIT 10
  `, queryParams)

  // Get Top Corporations (by final blow)
  const topCorporations = await database.query<{
    attacker_corporation_id: number
    attacker_corporation_name: string
    kills: number
  }>(`
    SELECT
      attacker_corporation_id,
      attacker_corporation_name,
      count() as kills
    FROM entity_killlist
    WHERE killmail_time >= now() - INTERVAL 30 DAY
      AND attacker_corporation_name != ''
      ${whereClauseToAndConditions(whereClause.clause) ? `AND ${whereClauseToAndConditions(whereClause.clause)}` : ''}
    GROUP BY attacker_corporation_id, attacker_corporation_name
    ORDER BY kills DESC
    LIMIT 10
  `, queryParams)

  // Get Top Alliances (by final blow)
  const topAlliances = await database.query<{
    attacker_alliance_id: number
    attacker_alliance_name: string
    kills: number
  }>(`
    SELECT
      attacker_alliance_id,
      attacker_alliance_name,
      count() as kills
    FROM entity_killlist
    WHERE killmail_time >= now() - INTERVAL 30 DAY
      AND attacker_alliance_name != ''
      ${whereClauseToAndConditions(whereClause.clause) ? `AND ${whereClauseToAndConditions(whereClause.clause)}` : ''}
    GROUP BY attacker_alliance_id, attacker_alliance_name
    ORDER BY kills DESC
    LIMIT 10
  `, queryParams)

  // Get Most Valuable Kills
  const mostValuableKillsRaw = await database.query<{
    killmail_id: number
    killmail_time: string
    total_value: number
    victim_character_name: string
    victim_corporation_name: string
    victim_ship_type_id: number
    victim_ship_name: string
    solar_system_name: string
    region_name: string
  }>(`
    SELECT
      killmail_id,
      killmail_time,
      total_value,
      victim_character_name,
      victim_corporation_name,
      victim_ship_type_id,
      victim_ship_name,
      solar_system_name,
      region_name
    FROM entity_killlist
    ${whereClause.clause}
    ORDER BY total_value DESC
    LIMIT 6
  `, queryParams)

  const mostValuableKills = mostValuableKillsRaw.map(k => ({
    killmail_id: k.killmail_id,
    killmail_time: new Date(k.killmail_time),
    total_value: k.total_value,
    victim: {
      character_name: k.victim_character_name,
      corporation_name: k.victim_corporation_name,
      ship: {
        type_id: k.victim_ship_type_id,
        name: k.victim_ship_name
      }
    },
    solar_system: {
      name: k.solar_system_name,
      region: k.region_name
    }
  }))

  // Format top boxes data for partial
  const topCharactersFormatted = topCharacters.map(c => ({
    name: c.attacker_character_name,
    kills: c.kills,
    imageType: 'character',
    imageId: c.attacker_character_id,
    link: `/character/${c.attacker_character_id}`
  }))

  const topCorporationsFormatted = topCorporations.map(c => ({
    name: c.attacker_corporation_name,
    kills: c.kills,
    imageType: 'corporation',
    imageId: c.attacker_corporation_id,
    link: `/corporation/${c.attacker_corporation_id}`
  }))

  const topAlliancesFormatted = topAlliances.map(a => ({
    name: a.attacker_alliance_name,
    kills: a.kills,
    imageType: 'alliance',
    imageId: a.attacker_alliance_id,
    link: `/alliance/${a.attacker_alliance_id}`
  }))

  const topSystemsFormatted = topSystems.map(s => ({
    name: s.solar_system_name,
    kills: s.kills,
    imageType: 'system',
    imageId: s.solar_system_id,
    link: `/system/${s.solar_system_id}`
  }))

  const topRegionsFormatted = topRegions.map(r => ({
    name: r.region_name,
    kills: r.kills,
    imageType: 'region',
    imageId: r.region_id,
    link: `/region/${r.region_id}`
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

  // Render the template
  return render(
    'pages/kills',
    {
      title: getTitleForType(killType),
      description: `Browse ${getTitleForType(killType).toLowerCase()} on EDK`,
      keywords: 'eve online, killmail, pvp, kills'
    },
    {
      title: getTitleForType(killType),
      recentKillmails,
      pagination,
      topCharactersFormatted,
      topCorporationsFormatted,
      topAlliancesFormatted,
      topSystemsFormatted,
      topRegionsFormatted,
      mostValuableKills
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
