import { z } from 'zod';
import { validate } from '~/server/utils/validation';
import type { H3Event } from 'h3'
import { timeAgo } from '../../helpers/time'
import { render, normalizeKillRow } from '../../helpers/templates'
import { getFilteredKillsWithNames, countFilteredKills, buildKilllistConditions, type KilllistFilters } from '../../models/killlist'
import {
  getTopSystemsFiltered,
  getTopRegionsFiltered,
  getTopCharactersFiltered,
  getTopCorporationsFiltered,
  getTopAlliancesFiltered
} from '../../models/topBoxes'

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

/**
 * Build filters based on the kill type
 * Uses pre-computed columns in killlist for maximum performance
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

export default defineEventHandler(async (event: H3Event) => {
  const { params, query } = await validate(event, {
    params: z.object({
      type: z.string().refine(val => VALID_KILL_TYPES.includes(val as KillType)),
    }),
    query: z.object({
      page: z.coerce.number().int().positive().optional().default(1),
    }),
  });

  const { type: killType } = params;
  const { page } = query;

  // Get pagination parameters
  const perPage = 30

  // Build filters based on the type
  const filters = buildFiltersForType(killType as KillType)

  const conditionsForTopBoxes = buildKilllistConditions(filters, 'k')

  // Fetch killmails and count in parallel using model functions
  const [killmailsData, totalKillmails] = await Promise.all([
    getFilteredKillsWithNames(filters, page, perPage),
    countFilteredKills(filters)
  ])

  const totalPages = Math.ceil(totalKillmails / perPage)

  // Format killmail data for template
  const recentKillmails = killmailsData.map(km => {
    const normalized = normalizeKillRow(km)
    return {
      ...normalized,
      killmailTimeRelative: timeAgo(new Date(km.killmailTime ?? normalized.killmailTime))
    }
  })

  // Get Top Boxes data using model functions with conditions
  const [topSystems, topRegions, topCharacters, topCorporations, topAlliances] = await Promise.all([
    getTopSystemsFiltered(conditionsForTopBoxes, 10),
    getTopRegionsFiltered(conditionsForTopBoxes, 10),
    getTopCharactersFiltered(conditionsForTopBoxes, 10),
    getTopCorporationsFiltered(conditionsForTopBoxes, 10),
    getTopAlliancesFiltered(conditionsForTopBoxes, 10)
  ])

  // Get Most Valuable Kills for this filter
  // Note: Using the filtered killmails function with ordering by value
  const mostValuableKillsData = await getFilteredKillsWithNames({...filters, minValue: undefined}, 1, 6)
  // Sort by value descending (in case the query doesn't)
  mostValuableKillsData.sort((a, b) => b.totalValue - a.totalValue)

  const mostValuableKills = mostValuableKillsData.map(k => {
    const normalized = normalizeKillRow(k)
    const killmailTimeRaw: unknown = k.killmailTime ?? normalized.killmailTime
    const killmailTimeValue = killmailTimeRaw instanceof Date
      ? killmailTimeRaw.toISOString()
      : String(killmailTimeRaw)
    return {
      ...normalized,
      totalValue: k.totalValue ?? normalized.totalValue,
      killmailTime: killmailTimeValue
    }
  })

  // Format top boxes data for partial
  const topCharactersFormatted = topCharacters.map(c => ({
    name: c.name,
    kills: c.kills,
    imageType: 'character',
    imageId: c.id,
    link: `/character/${c.id}`
  }))

  const topCorporationsFormatted = topCorporations.map(c => ({
    name: c.name,
    kills: c.kills,
    imageType: 'corporation',
    imageId: c.id,
    link: `/corporation/${c.id}`
  }))

  const topAlliancesFormatted = topAlliances.map(a => ({
    name: a.name,
    kills: a.kills,
    imageType: 'alliance',
    imageId: a.id,
    link: `/alliance/${a.id}`
  }))

  const topSystemsFormatted = topSystems.map(s => ({
    name: s.name,
    kills: s.kills,
    imageType: 'system',
    imageId: s.id,
    link: `/system/${s.id}`
  }))

  const topRegionsFormatted = topRegions.map(r => ({
    name: r.name,
    kills: r.kills,
    imageType: 'region',
    imageId: r.id,
    link: `/region/${r.id}`
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
      title: getTitleForType(killType as KillType),
      description: `Browse ${getTitleForType(killType as KillType).toLowerCase()} on EDK`,
      keywords: 'eve online, killmail, pvp, kills'
    },
    {
      title: getTitleForType(killType as KillType),
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
