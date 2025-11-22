import type { H3Event } from 'h3'
import { timeAgo } from '../../../helpers/time'
import { render, normalizeKillRow } from '../../../helpers/templates'
import { getEntityStats } from '../../../models/entityStats'
import { getCharacterWithCorporationAndAlliance } from '../../../models/characters'
import { getEntityKillmails, countEntityKillmails } from '../../../models/killlist'

import { handleError } from '../../../utils/error'

export default defineEventHandler(async (event: H3Event) => {
  try {
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

    // Get character stats
    const stats = await getEntityStats(characterId, 'character', 'all')

    // Get pagination parameters
    const query = getQuery(event)
    const page = Math.max(1, Number.parseInt(query.page as string) || 1)
    const perPage = 30

    // Fetch killmails where character was attacker (kills) using model
    const [killmailsData, totalKillmails] = await Promise.all([
      getEntityKillmails(characterId, 'character', 'kills', page, perPage),
      countEntityKillmails(characterId, 'character', 'kills')
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
      entityId: characterId,
      entityType: 'character',
      name: characterData.name,
      type: 'character',
      stats,
      baseUrl: `/character/${characterId}/kills`,
      entityBaseUrl: `/character/${characterId}`,
      currentTab: 'kills',
      parent: characterData.corporationId
        ? {
            id: characterData.corporationId,
            name: characterData.corporationName,
            ticker: characterData.corporationTicker
          }
        : null,
      grandparent: characterData.allianceId
        ? {
            id: characterData.allianceId,
            name: characterData.allianceName,
            ticker: characterData.allianceTicker
          }
        : null
    }

    // Render the template
    return render(
      'pages/character-kills',
      {
        title: `${characterData.name} - Kills`,
        description: `Kills by ${characterData.name}`,
        keywords: 'eve online, character, killmail, kills, pvp'
      },
      {
        ...entityData,
        killmails,
        pagination
      }
    )
  } catch (error) {
    return handleError(event, error)
  }
})

import { generatePageNumbers } from '../../../utils/pagination'
