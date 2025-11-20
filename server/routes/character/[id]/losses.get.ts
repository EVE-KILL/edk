import type { H3Event } from 'h3'
import { timeAgo } from '../../../helpers/time'
import { render, normalizeKillRow } from '../../../helpers/templates'
import { getEntityStats } from '../../../models/entityStats'
import { getCharacterWithCorporationAndAlliance } from '../../../models/characters'
import { getEntityKillmails, countEntityKillmails } from '../../../models/killlist'

export default defineEventHandler(async (event: H3Event) => {
  const characterId = Number.parseInt(getRouterParam(event, 'id') || '0')

  if (!characterId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid character ID'
    })
  }

  // Fetch character basic info using model
  const characterData = await getCharacterWithCorporationAndAlliance(characterId)

  if (!characterData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Character not found'
    })
  }

  // Get character stats using the same query as dashboard
  const stats = await getEntityStats(characterId, 'character', 'all')

  // Get pagination parameters
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(query.page as string) || 1)
  const perPage = 30

  // Fetch killmails where character was victim (losses) using model
  const [killmailsData, totalKillmails] = await Promise.all([
    getEntityKillmails(characterId, 'character', 'losses', page, perPage),
    countEntityKillmails(characterId, 'character', 'losses')
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
      isLoss: true,
      killmailTimeRelative: timeAgo(new Date(km.killmailTime ?? normalized.killmailTime))
    }
  })

  // Entity header data
  const entityData = {
    entityId: characterId,
    entityType: 'character',
    name: characterData.name,
    type: 'character',
    stats,
    baseUrl: `/character/${characterId}/losses`,
    entityBaseUrl: `/character/${characterId}`,
    currentTab: 'losses',
    parent: {
      id: characterData.corporationId,
      name: characterData.corporationName,
      ticker: characterData.corporationTicker
    },
    grandparent: characterData.allianceId ? {
      id: characterData.allianceId,
      name: characterData.allianceName,
      ticker: characterData.allianceTicker
    } : null
  }

  // Render the template
  return render(
    'pages/character-losses',
    {
      title: `${characterData.name} - Losses`,
      description: `Losses by ${characterData.name}`,
      keywords: 'eve online, character, killmail, losses, pvp'
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
