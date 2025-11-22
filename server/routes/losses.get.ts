import { z } from 'zod';
import { validate } from '~/server/utils/validation';
import type { H3Event } from 'h3'
import { render, normalizeKillRow } from '../helpers/templates'
import { getFollowedEntitiesLosses, countFollowedEntitiesLosses } from '../models/killlist'

export default defineEventHandler(async (event: H3Event) => {
  const { query } = await validate(event, {
    query: z.object({
      page: z.coerce.number().int().positive().optional().default(1),
    }),
  });

  const { page } = query;

  const pageContext = {
    title: 'Losses | EVE-KILL',
    description: 'Losses for followed entities',
    keywords: 'eve online, losses, tracking'
  }

  const charIds = process.env.FOLLOWED_CHARACTER_IDS?.split(',').map(Number).filter(n => !isNaN(n) && n > 0) || []
  const corpIds = process.env.FOLLOWED_CORPORATION_IDS?.split(',').map(Number).filter(n => !isNaN(n) && n > 0) || []
  const allyIds = process.env.FOLLOWED_ALLIANCE_IDS?.split(',').map(Number).filter(n => !isNaN(n) && n > 0) || []

  const hasEntities = charIds.length > 0 || corpIds.length > 0 || allyIds.length > 0

  // Get pagination parameters
  const perPage = 30

  let killmails: any[] = []
  let totalKillmails = 0

  if (hasEntities) {
     const [killmailsData, count] = await Promise.all([
        getFollowedEntitiesLosses(charIds, corpIds, allyIds, page, perPage),
        countFollowedEntitiesLosses(charIds, corpIds, allyIds)
     ])
     killmails = killmailsData.map(normalizeKillRow)
     totalKillmails = count
  }

  const totalPages = Math.ceil(totalKillmails / perPage)

  const data = {
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
    baseUrl: '/losses'
  }

  return render('pages/losses.hbs', pageContext, data, event)
})
