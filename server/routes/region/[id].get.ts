import { z } from 'zod'
import { withValidation, getValidated } from '~/server/utils/validation'
import type { H3Event } from 'h3'
import { getRegion, getRegionStats } from '../../models/regions'
import { getFilteredKillsWithNames, countFilteredKills } from '../../models/killlist'
import { getTopByKills } from '../../models/topBoxes'
import { normalizeKillRow, render } from '../../helpers/templates'

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
  const id = parseInt(params.id, 10)
  const page = parseInt(query.page || '1', 10)

  // Fetch region info
  const region = await getRegion(id)
  if (!region) {
    throw createError({ statusCode: 404, statusMessage: 'Region not found' })
  }

  // Page context
  const pageContext = {
    title: `${region.name} | Region`,
    description: `Killboard statistics and activity for region ${region.name}`,
    keywords: `eve online, killboard, ${region.name}, region, pvp`
  }

  // Get pagination parameters
  const perPage = 50

  // Fetch stats and killmails in parallel
  // TODO: Filter top lists by region
  const [stats, killmailsData, totalKillmails, topCharacters, topCorporations, topAlliances] = await Promise.all([
    getRegionStats(id),
    getFilteredKillsWithNames({ regionId: id }, page, perPage), // We need to ensure getFilteredKillsWithNames supports regionId
    countFilteredKills({ regionId: id }),
    getTopByKills('week', 'character', 10),
    getTopByKills('week', 'corporation', 10),
    getTopByKills('week', 'alliance', 10)
  ])

  const totalPages = Math.ceil(totalKillmails / perPage)

  // Normalize killmail data
  const killmails = killmailsData.map(normalizeKillRow)

  // Prepare top 10 stats
  const top10Stats = {
    characters: topCharacters.map(c => ({
      ...c,
      imageType: 'character',
      imageId: c.id,
      link: `/character/${c.id}`
    })),
    corporations: topCorporations.map(c => ({
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

  const data = {
    region,
    stats,
    killmails,
    top10Stats,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalKillmails: totalKillmails,
      perPage: perPage,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
    },
    baseUrl: `/region/${id}`
  }

  return render('pages/region-detail.hbs', pageContext, data, event)
}))
