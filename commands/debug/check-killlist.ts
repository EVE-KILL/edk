import { database } from '../../server/helpers/database'
import { logger } from '../../server/helpers/logger'

export const description = 'Check killlist_frontpage materialized view data'

export async function action() {
  try {
    logger.info('Checking killlist_frontpage materialized view...')

    // Check if view exists
    const viewExists = await database.queryOne<{ count: number }>(
      `SELECT count() as count FROM system.tables WHERE database = 'edk' AND name = 'killlist_frontpage'`
    )

    if (!viewExists || viewExists.count === 0) {
      logger.error('killlist_frontpage view does not exist!')
      return
    }

    logger.success('✓ killlist_frontpage view exists')

    // Get total row count
    const totalCount = await database.queryValue<number>(
      'SELECT count() FROM edk.killlist_frontpage'
    )

    logger.info(`Total rows in view: ${totalCount}`)

    // Get sample data (first 5 rows)
    const sampleData = await database.query<any>(
      `SELECT 
        killmail_id,
        killmail_time,
        victim_ship_name,
        victim_character_name,
        victim_corporation_name,
        attacker_character_name,
        attacker_corporation_name,
        solar_system_name,
        region_name,
        ship_value,
        attacker_count
      FROM edk.killlist_frontpage 
      ORDER BY killmail_time DESC 
      LIMIT 5`
    )

    if (sampleData.length === 0) {
      logger.warn('No data in killlist_frontpage view')
      return
    }

    logger.success(`\nSample data (${sampleData.length} rows):`)
    console.log('='.repeat(120))

    for (const row of sampleData) {
      console.log(`\nKillmail ID: ${row.killmail_id}`)
      console.log(`  Time: ${row.killmail_time}`)
      console.log(`  Victim: ${row.victim_character_name} (${row.victim_corporation_name})`)
      console.log(`    Ship: ${row.victim_ship_name}`)
      console.log(`  Attacker: ${row.attacker_character_name} (${row.attacker_corporation_name})`)
      console.log(`  Location: ${row.solar_system_name} (${row.region_name})`)
      console.log(`  Value: ${row.ship_value} ISK`)
      console.log(`  Attackers: ${row.attacker_count}`)
    }

    console.log('='.repeat(120))

    // Check for NULL attacker data (final blow issues)
    const nullAttackerCount = await database.queryValue<number>(
      `SELECT count() FROM edk.killlist_frontpage WHERE attacker_character_name = 'Unknown' OR attacker_character_name IS NULL`
    )

    if (nullAttackerCount && nullAttackerCount > 0) {
      logger.warn(`\n⚠️  Found ${nullAttackerCount} killmails with missing final blow attacker data`)

      // Show a sample
      const nullSample = await database.query<any>(
        `SELECT 
          killmail_id,
          victim_character_name,
          attacker_character_name,
          attacker_corporation_name
        FROM edk.killlist_frontpage 
        WHERE attacker_character_name = 'Unknown' OR attacker_character_name IS NULL
        LIMIT 3`
      )

      console.log('\nSample killmails with missing attacker data:')
      for (const row of nullSample) {
        console.log(`  Killmail ${row.killmail_id}: victim=${row.victim_character_name}, attacker=${row.attacker_character_name || 'NULL'}`)
      }
    } else {
      logger.success('\n✓ All killmails have final blow attacker data')
    }

    // Check attacker table directly for comparison
    const attackerStats = await database.queryOne<any>(
      `SELECT 
        count() as total_attackers,
        countIf(finalBlow = 1) as final_blow_count,
        count(DISTINCT killmailId) as distinct_killmails
      FROM edk.attackers`
    )

    console.log('\nAttacker table statistics:')
    console.log(`  Total attackers: ${attackerStats.total_attackers}`)
    console.log(`  Final blow attackers: ${attackerStats.final_blow_count}`)
    console.log(`  Distinct killmails: ${attackerStats.distinct_killmails}`)

    if (attackerStats.final_blow_count !== attackerStats.distinct_killmails) {
      logger.warn(`\n⚠️  Mismatch: ${attackerStats.final_blow_count} final blows but ${attackerStats.distinct_killmails} killmails`)
    }

  } catch (error) {
    logger.error('Error checking killlist_frontpage:', { error })
    throw error
  }
}
