import type { H3Event } from 'h3'
import { render, normalizeKillRow } from '../../helpers/templates'
import { getFollowedEntitiesActivity, countFollowedEntitiesActivity } from '../../models/killlist'
import { handleError } from '../../utils/error'

export default defineEventHandler(async (event: H3Event) => {
  try {
    const pageContext = {
      title: 'Entities Kills | EVE-KILL',
      description: 'Kills for followed entities',
      keywords: 'eve online, kills, tracking'
    }

    const charIds = process.env.FOLLOWED_CHARACTER_IDS?.split(',').map(Number).filter(n => !isNaN(n) && n > 0) || []
    const corpIds = process.env.FOLLOWED_CORPORATION_IDS?.split(',').map(Number).filter(n => !isNaN(n) && n > 0) || []
    const allyIds = process.env.FOLLOWED_ALLIANCE_IDS?.split(',').map(Number).filter(n => !isNaN(n) && n > 0) || []

    const hasEntities = charIds.length > 0 || corpIds.length > 0 || allyIds.length > 0

    // Get pagination parameters
    const query = getQuery(event)
    const page = Math.max(1, Number.parseInt(query.page as string) || 1)
    const perPage = 30

    let killmails: any[] = []
    let totalKillmails = 0

    if (hasEntities) {
      const [killmailsData, count] = await Promise.all([
        getFollowedEntitiesActivity(charIds, corpIds, allyIds, page, perPage),
        countFollowedEntitiesActivity(charIds, corpIds, allyIds)
      ])
      killmails = killmailsData.map(normalizeKillRow)
      totalKillmails = count
    }

    const totalPages = Math.ceil(totalKillmails / perPage)

    const data = {
      hasEntities,
      killmails,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalKillmails: totalKillmails,
        perPage: perPage,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevPage: page - 1,
        nextPage: page + 1
      },
      entityBaseUrl: '/entities',
      currentTab: 'kills'
    }

    return render('pages/entities-kills.hbs', pageContext, data, event)
  } catch (error) {
    return handleError(event, error)
  }
})
