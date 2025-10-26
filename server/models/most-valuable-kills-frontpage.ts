/**
 * Most Valuable Kills Frontpage Model
 *
 * Queries the most_valuable_kills_frontpage materialized view for home page display
 * This view contains pre-joined data with entity names and calculated total values
 */

export interface MostValuableKill {
  killmail_id: number
  killmail_time: Date
  total_value: number
  victim: {
    ship: {
      type_id: number
      name: string
    }
    character: {
      id: number | null
      name: string
    }
    corporation: {
      id: number
      ticker: string
    }
  }
}

/**
 * Get most valuable killmails (last 7 days)
 * @param limit Number of killmails to return (default: 6)
 * @returns Array of most valuable killmails
 */
export async function getMostValuableKills(limit: number = 6): Promise<MostValuableKill[]> {
  const sql = `
    SELECT
      killmail_id,
      killmail_time,
      total_value,
      victim_ship_type_id,
      victim_ship_name,
      victim_character_id,
      victim_character_name,
      victim_corporation_id,
      victim_corporation_ticker
    FROM most_valuable_kills_frontpage
    WHERE killmail_time >= now() - INTERVAL 7 DAY
    ORDER BY total_value DESC
    LIMIT {limit:UInt32}
  `

  const result = await database.query<{
    killmail_id: number
    killmail_time: Date
    total_value: number
    victim_ship_type_id: number
    victim_ship_name: string
    victim_character_id: number | null
    victim_character_name: string
    victim_corporation_id: number
    victim_corporation_ticker: string
  }>(sql, { limit })

  // Transform to match template expectations
  return result.map(row => ({
    killmail_id: row.killmail_id,
    killmail_time: row.killmail_time,
    total_value: row.total_value,
    victim: {
      ship: {
        type_id: row.victim_ship_type_id,
        name: row.victim_ship_name
      },
      character: {
        id: row.victim_character_id,
        name: row.victim_character_name
      },
      corporation: {
        id: row.victim_corporation_id,
        ticker: row.victim_corporation_ticker
      }
    }
  }))
}
