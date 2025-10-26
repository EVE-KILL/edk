import type { H3Event } from 'h3'

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
  const offset = (page - 1) * perPage

  // Fetch total count for pagination
  const totalKillmails = await getTotalKillmailCount()
  const totalPages = Math.ceil(totalKillmails / perPage)

  // Fetch recent killmails from materialized view
  const killmailsData = await getRecentKillmails(perPage, offset)

  // Fetch top 10 stats
  const top10Stats = await getTopBoxStats()

  // Transform top10Stats to add imageType and link properties
  const top10 = {
    characters: top10Stats.characters.map(c => ({
      ...c,
      imageType: 'character',
      imageId: c.id,
      link: `/character/${c.id}`
    })),
    corporations: top10Stats.corporations.map(c => ({
      ...c,
      imageType: 'corporation',
      imageId: c.id,
      link: `/corporation/${c.id}`
    })),
    alliances: top10Stats.alliances.map(a => ({
      ...a,
      imageType: 'alliance',
      imageId: a.id,
      link: `/alliance/${a.id}`
    })),
    systems: top10Stats.systems.map(s => ({
      ...s,
      imageType: 'system',
      imageId: s.id,
      link: `/system/${s.id}`
    })),
    regions: top10Stats.regions.map(r => ({
      ...r,
      imageType: 'region',
      imageId: r.id,
      link: `/region/${r.id}`
    }))
  }

  // Fetch most valuable kills (last 7 days)
  const mostValuableKills = await getMostValuableKills(6)

  // Transform killmail data to match component expectations
  const killmails = killmailsData.map(km => ({
    killmail_id: km.killmail_id,
    victim: {
      ship: {
        type_id: km.victim_ship_type_id,
        name: km.victim_ship_name || 'Unknown Ship',
        group: km.victim_ship_group || 'Unknown'
      },
      character: {
        id: km.victim_character_id,
        name: km.victim_character_name || 'Unknown'
      },
      corporation: {
        id: km.victim_corporation_id,
        name: km.victim_corporation_name || 'Unknown Corp',
        ticker: km.victim_corporation_ticker || '???'
      },
      alliance: km.victim_alliance_id ? {
        id: km.victim_alliance_id,
        name: km.victim_alliance_name || 'Unknown Alliance',
        ticker: km.victim_alliance_ticker || '???'
      } : undefined
    },
    attackers: [{
      character: {
        id: km.attacker_character_id || 0,
        name: km.attacker_character_name || 'Unknown'
      },
      corporation: {
        id: km.attacker_corporation_id || 0,
        name: km.attacker_corporation_name || 'Unknown Corp',
        ticker: km.attacker_corporation_ticker || '???'
      },
      alliance: km.attacker_alliance_id ? {
        id: km.attacker_alliance_id,
        name: km.attacker_alliance_name || 'Unknown Alliance',
        ticker: km.attacker_alliance_ticker || '???'
      } : undefined
    }],
    solar_system: {
      id: km.solar_system_id,
      name: km.solar_system_name || 'Unknown System',
      region: km.region_name || 'Unknown Region'
    },
    ship_value: km.ship_value || 0,
    total_value: km.total_value || 0,
    attacker_count: km.attacker_count || 0,
    killmail_time: timeAgo(new Date(km.killmail_time))
  }))

  // Data for the home page
  const data = {
    // Real Most Valuable Kills from database (last 7 days)
    mostValuableKills: mostValuableKills.map(mvk => ({
      killmail_id: mvk.killmail_id,
      victim: mvk.victim,
      total_value: mvk.total_value, // Pass raw number for abbreviateISK helper
      killmail_time: mvk.killmail_time // Pass raw date/string for formatDate helper
    })),

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
