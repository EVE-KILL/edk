import type { H3Event } from 'h3'
import { render } from '../helpers/templates'

export default defineEventHandler(async (event: H3Event) => {
  const pageContext = {
    title: 'Statistics | EVE-KILL',
    description: 'View statistics for tracked entities',
    keywords: 'eve online, statistics, tracking'
  }

  const charIds = process.env.FOLLOWED_CHARACTER_IDS?.split(',').map(id => id.trim()).filter(id => id) || []
  const corpIds = process.env.FOLLOWED_CORPORATION_IDS?.split(',').map(id => id.trim()).filter(id => id) || []
  const allyIds = process.env.FOLLOWED_ALLIANCE_IDS?.split(',').map(id => id.trim()).filter(id => id) || []

  const hasEntities = charIds.length > 0 || corpIds.length > 0 || allyIds.length > 0

  const followedEntities = {
    hasEntities,
    characters: charIds,
    corporations: corpIds,
    alliances: allyIds
  }

  const data = {
    followedEntities
  }

  return render('pages/statistics.hbs', pageContext, data, event)
})
