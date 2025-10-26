import { database } from '../../server/helpers/database'
import { logger } from '../../server/helpers/logger'

export const description = 'Check attacker IDs in killlist_frontpage'

export async function action() {
  try {
    logger.info('Checking attacker IDs in killlist_frontpage...')

    // Get sample data with all attacker fields
    const sampleData = await database.query<any>(
      `SELECT
        killmail_id,
        attacker_character_id,
        attacker_character_name,
        attacker_corporation_id,
        attacker_corporation_name,
        attacker_alliance_id,
        attacker_alliance_name
      FROM edk.killlist_frontpage
      ORDER BY killmail_time DESC
      LIMIT 5`
    )

    if (sampleData.length === 0) {
      logger.warn('No data in killlist_frontpage view')
      return
    }

    logger.success(`Sample attacker data (${sampleData.length} rows):`)
    console.log('='.repeat(120))

    for (const row of sampleData) {
      console.log(`\nKillmail ID: ${row.killmail_id}`)
      console.log(`  Character ID: ${row.attacker_character_id} -> "${row.attacker_character_name}"`)
      console.log(`  Corporation ID: ${row.attacker_corporation_id} -> "${row.attacker_corporation_name}"`)
      console.log(`  Alliance ID: ${row.attacker_alliance_id} -> "${row.attacker_alliance_name}"`)
    }

    console.log('='.repeat(120))

    // Check one killmail in attackers table directly
    const firstKillmailId = sampleData[0].killmail_id
    const attackerData = await database.query<any>(
      `SELECT * FROM edk.attackers WHERE killmailId = {id:UInt32} AND finalBlow = 1`,
      { id: firstKillmailId }
    )

    console.log(`\nDirect attackers table query for killmail ${firstKillmailId}:`)
    console.log(JSON.stringify(attackerData, null, 2))

  } catch (error) {
    logger.error('Error checking attacker IDs:', { error })
    throw error
  }
}
