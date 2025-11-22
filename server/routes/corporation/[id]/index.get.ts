/**
 * Corporation entity page - dashboard
 */
import type { H3Event } from 'h3'
import { timeAgo } from '../../../helpers/time'
import { render, normalizeKillRow } from '../../../helpers/templates'
import { getCorporationWithAlliance } from '../../../models/corporations'
import { getEntityKillmails, countEntityKillmails } from '../../../models/killlist'
import { getEntityStats } from '../../../models/entityStats'
import { getMostValuableKillsByCorporation } from '../../../models/mostValuableKills'
import { getTopByKills } from '../../../models/topBoxes'

import { handleError } from '../../../utils/error'

export default defineEventHandler(async (event: H3Event) => {
  try {
    const corporationId = Number.parseInt(getRouterParam(event, 'id') || '0')

    if (!corporationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid corporation ID'
      })
    }

    // Fetch corporation basic info using model
    const corporationData = await getCorporationWithAlliance(corporationId)

    if (!corporationData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Corporation not found'
      })
    }

    // Fetch all entity data in parallel
    const [stats, topSystems, topRegions, topCorps, topAlliances, mostValuable] = await Promise.all([
      getEntityStats(corporationId, 'corporation', 'all'),
      getTopByKills('week', 'system', 10),
      getTopByKills('week', 'region', 10),
      getTopByKills('week', 'corporation', 10),
      getTopByKills('week', 'alliance', 10),
      getMostValuableKillsByCorporation(corporationId, 'all', 6)
    ])

    // Get pagination parameters
    const query = getQuery(event)
    const page = Math.max(1, Number.parseInt(query.page as string) || 1)
    const perPage = 30

    // Fetch paginated killmails using model function
    const [killmails, totalKillmails] = await Promise.all([
      getEntityKillmails(corporationId, 'corporation', 'all', page, perPage),
      countEntityKillmails(corporationId, 'corporation', 'all')
    ])

    const totalPages = Math.ceil(totalKillmails / perPage)

    // Format killmail data for template
    const recentKillmails = killmails.map(km => {
      const normalized = normalizeKillRow(km)
      return {
        ...normalized,
        isLoss: km.victimCorporationId === corporationId,
        killmailTimeRelative: timeAgo(new Date(km.killmailTime ?? normalized.killmailTime))
      }
    })

    // Entity header data
    const entityData = {
      entityId: corporationId,
      entityType: 'corporation',
      name: corporationData.name,
      type: 'corporation',
      stats,
      baseUrl: `/corporation/${corporationId}`,
      entityBaseUrl: `/corporation/${corporationId}`,
      currentTab: 'dashboard',
      parent: corporationData.allianceId
        ? {
            id: corporationData.allianceId,
            name: corporationData.allianceName,
            ticker: corporationData.allianceTicker
          }
        : null,
      grandparent: null
    }

    // Top boxes - for corporations we show systems, regions, corporations, alliances
    const top10 = {
      characters: [],
      systems: (topSystems as any[]).map((s: any) => ({
        ...s,
        imageType: 'system',
        imageId: s.id,
        link: `/system/${s.id}`
      })),
      regions: (topRegions as any[]).map((r: any) => ({
        ...r,
        imageType: 'region',
        imageId: r.id,
        link: `/region/${r.id}`
      })),
      corporations: (topCorps as any[]).map((c: any) => ({
        ...c,
        imageType: 'corporation',
        imageId: c.id,
        link: `/corporation/${c.id}`
      })),
      alliances: (topAlliances as any[]).map((a: any) => ({
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
      'pages/corporation-detail',
      {
        title: `${corporationData.name} - Corporation`,
        description: `Corporation statistics for ${corporationData.name}`,
        keywords: 'eve online, corporation, killmail, pvp'
      },
      {
        ...entityData,
        top10Stats: top10,
        mostValuableKills: transformedMostValuable,
        recentKillmails,
        pagination
      }
    )
  } catch (error) {
    return handleError(event, error)
  }
})

import { generatePageNumbers } from '../../../utils/pagination'
