import { getKillmail } from '../../server/models/killmails-esi'

/**
 * Test command to verify killmail reconstruction from database
 *
 * Usage:
 *   bun run cli test:killmail-reconstruct --id 130756307
 *
 * This will fetch the killmail from the database and output it in ESI format
 */
export default {
  description: 'Test killmail reconstruction - Fetches from DB and outputs in ESI format',
  options: [
    {
      flags: '-i, --id <killmail_id>',
      description: 'The killmail ID to reconstruct'
    }
  ],
  async action(options: { id?: string }) {
    if (!options.id) {
      console.error('❌ Usage: bun run cli test:killmail-reconstruct --id <killmail_id>')
      console.error('Example: bun run cli test:killmail-reconstruct --id 130756307')
      return
    }

    const id = parseInt(options.id, 10)

    if (isNaN(id)) {
      console.error('❌ Invalid killmail ID. Must be a number.')
      return
    }

    console.log(`🔍 Fetching killmail ${id} from database...\n`)

    try {
      const killmail = await getKillmail(id)

      if (!killmail) {
        console.error(`❌ Killmail ${id} not found in database`)
        return
      }

      console.log('✅ Killmail reconstructed successfully!\n')
      console.log(JSON.stringify(killmail, null, 2))
    } catch (error) {
      console.error(`❌ Error fetching killmail:`, error)
    }
  }
}
