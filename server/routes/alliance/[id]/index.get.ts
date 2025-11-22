
import { z } from 'zod'
import { withValidation, getValidated } from '~/server/utils/validation'
import type { H3Event } from 'h3'
import { timeAgo } from '../../../helpers/time'
import { render, normalizeKillRow } from '../../../helpers/templates'
import { getAlliance } from '../../../models/alliances'
import { getEntityKillmails, countEntityKillmails } from '../../../models/killlist'
import { getEntityStats } from '../../../models/entityStats'
import { getMostValuableKillsByAlliance } from '../../../models/mostValuableKills'
import { getTopByKills } from '../../../models/topBoxes'

export default withValidation({
  params: z.object({
    id: z.string().refine(val => !isNaN(parseInt(val, 10)), {
      message: 'ID must be a number'
    })
  }),
  query: z.object({
    page: z.string().optional().default('1').refine(val => !isNaN(parseInt(val, 10)), {
      message: 'Page must be a number'
    })
  })
})(defineEventHandler(async (event: H3Event) => {
  const { params, query } = getValidated(event)
  const allianceId = parseInt(params.id, 10)
  const page = parseInt(query.page || '1', 10)

  // Fetch alliance basic info using model
  const allianceData = await getAlliance(allianceId)

  if (!allianceData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Alliance not found'
    })
  }

  // Fetch all entity data in parallel
  const [stats, topSystems, topRegions, topCorps, topAlliances, mostValuable] = await Promise.all([
    getEntityStats(allianceId, 'alliance', 'all'),
    getTopByKills('week', 'system', 10),
    getTopByKills('week', 'region', 10),
    getTopByKills('week', 'corporation', 10),
    getTopByKills('week', 'alliance', 10),
    getMostValuableKillsByAlliance(allianceId, 'all', 6)
  ])

  // TODO: Implement top systems/regions/corporations/alliances stats

  // Get pagination parameters
  const perPage = 30

  // Fetch paginated killmails using model function
  const [killmails, totalKillmails] = await Promise.all([
    getEntityKillmails(allianceId, 'alliance', 'all', page, perPage),
    countEntityKillmails(allianceId, 'alliance', 'all')
  ])

  const totalPages = Math.ceil(totalKillmails / perPage)

  // Format killmail data for template
  const recentKillmails = killmails.map(km => {
    const normalized = normalizeKillRow(km)
    return {
      ...normalized,
      isLoss: km.victimAllianceId === allianceId,
      killmailTimeRelative: timeAgo(new Date(km.killmailTime ?? normalized.killmailTime))
    }
  })

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
  const transformedMostValuable = mostValuable.map(kill => {
    const normalized = normalizeKillRow(kill)
    return {
      ...normalized,
      totalValue: kill.totalValue ?? normalized.totalValue,
      killmailTime: normalized.killmailTime
    }
  })

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
