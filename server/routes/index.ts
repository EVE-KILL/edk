import type { H3Event } from 'h3'
import { getFilteredKillsWithNames, countFilteredKills } from '../models/killlist'
import { getTopByKills } from '../models/topBoxes'
import { getMostValuableKillsByPeriod } from '../models/mostValuableKills'
import { normalizeKillRow } from '../helpers/templates'

export default defineEventHandler(async (event: H3Event) => {
  // Page context
  const pageContext = {
    title: 'Home',
    description: 'Welcome to EVE-KILL - Real-time killmail tracking and analytics',
    keywords: 'eve online, killmail, pvp, tracking'
  }

  // Get pagination parameters
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(query.page as string) || 1)
  const perPage = 30

  // Fetch recent killmails with names, count, and top 10 stats in parallel
  const [killmailsData, totalKillmails, topCharacters, topCorporations, topAlliances, topSystems, topRegions] = await Promise.all([
    getFilteredKillsWithNames({}, page, perPage),
    countFilteredKills({}),
    getTopByKills('week', 'character', 10),
    getTopByKills('week', 'corporation', 10),
    getTopByKills('week', 'alliance', 10),
    getTopByKills('week', 'system', 10),
    getTopByKills('week', 'region', 10)
  ])

  const totalPages = Math.ceil(totalKillmails / perPage)

  // Transform top10 stats to add imageType and link properties
  const top10 = {
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
    })),
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
    }))
  }

  // Fetch most valuable kills (weekly, top 6)
  const mostValuableKillsData = await getMostValuableKillsByPeriod('week', 6)

  // Normalize killmail data to a consistent template-friendly shape
  const killmails = killmailsData.map((km: any) => {
    const normalized = normalizeKillRow(km)
    const killmailDate = km.killmailTime ?? km.killmail_time ?? normalized.killmailTime
    return {
      ...normalized,
      killmailTimeRelative: timeAgo(new Date(killmailDate))
    }
  })

  // Data for the home page
  const data = {
    // Real Most Valuable Kills from database (last 7 days)
    mostValuableKills: mostValuableKillsData.map(mvk => {
      const normalized = normalizeKillRow(mvk)
      return {
        ...normalized,
        totalValue: mvk.totalValue ?? normalized.totalValue,
        killmailTime: mvk.killmailTime ?? normalized.killmailTime
      }
    }),

    // Real top 10 stats from database (last 7 days)
    top10Stats: top10,

    // Real killmail data from database
    killmails,

    // Real pagination based on actual killmail count
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalKillmails: totalKillmails,
      perPage: perPage,
      pages: generatePageNumbers(page, totalPages),
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      showFirst: page > 3 && totalPages > 5,
      showLast: page < totalPages - 2 && totalPages > 5
    },
    baseUrl: '/'
  }

    // Render template using the new layout system
  return render('pages/home.hbs', pageContext, data, event)
})

// Helper function to format time ago
function timeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds} sec ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`

  const years = Math.floor(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

// Helper function to generate page numbers for pagination
function generatePageNumbers(currentPage: number, totalPages: number): number[] {
  const pages: number[] = []
  const maxVisible = 5

  if (totalPages <= maxVisible) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    // Show current page with context
    let start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, start + maxVisible - 1)

    // Adjust start if we're near the end
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
  }

  return pages
}
