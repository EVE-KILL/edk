import { z } from 'zod'
import { withValidation, getValidated } from '~/server/utils/validation'
import { generatePageNumbers } from '~/server/utils/pagination'
import type { H3Event } from 'h3'
import { timeAgo } from '../../../helpers/time'
import { render, normalizeKillRow } from '../../../helpers/templates'
import { getEntityStats } from '../../../models/entityStats'
import { getCorporationWithAlliance } from '../../../models/corporations'
import { getEntityKillmails, countEntityKillmails } from '../../../models/killlist'

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
  const corporationId = parseInt(params.id, 10)
  const page = parseInt(query.page || '1', 10)

  // Fetch corporation basic info with alliance using model
  const corporationData = await getCorporationWithAlliance(corporationId)

  if (!corporationData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Corporation not found'
    })
  }

  // Get corporation stats
  const stats = await getEntityStats(corporationId, 'corporation', 'all')

  // Get pagination parameters
  const perPage = 30

  // Fetch killmails where corporation was attacker (kills) using model
  const [killmailsData, totalKillmails] = await Promise.all([
    getEntityKillmails(corporationId, 'corporation', 'kills', page, perPage),
    countEntityKillmails(corporationId, 'corporation', 'kills')
  ])

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
  const killmails = killmailsData.map(km => {
    const normalized = normalizeKillRow(km)
    return {
      ...normalized,
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
    baseUrl: `/corporation/${corporationId}/kills`,
    entityBaseUrl: `/corporation/${corporationId}`,
    currentTab: 'kills',
    parent: corporationData.allianceId ? {
      id: corporationData.allianceId,
      name: corporationData.allianceName,
      ticker: corporationData.allianceTicker
    } : null,
    grandparent: null
  }

  // Render the template
  return render(
    'pages/corporation-kills',
    {
      title: `${corporationData.name} - Kills`,
      description: `Kills by ${corporationData.name}`,
      keywords: 'eve online, corporation, killmail, kills, pvp'
    },
    {
      ...entityData,
      killmails,
      pagination
    }
  )
}))
