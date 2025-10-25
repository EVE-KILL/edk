import { streamParseJSONLines, extractLanguageField } from '../../server/helpers/sde/parser'
import { join } from 'path'

export default {
  description: 'Debug: Inspect raw parsed SDE data for a specific table',
  options: [
    {
      flags: '-t, --table <table_name>',
      description: 'Table name to inspect (e.g., mapSolarSystems, types, etc.)'
    },
    {
      flags: '-l, --limit <count>',
      description: 'Number of records to inspect (default: 2)'
    }
  ],
  async action(options: { table?: string; limit?: string }) {
    if (!options.table) {
      console.error('❌ Usage: bun cli debug:inspect-sde --table <table_name> [--limit <count>]')
      console.error('Example: bun cli debug:inspect-sde --table mapSolarSystems --limit 1')
      return
    }

    const limit = options.limit ? parseInt(options.limit, 10) : 2
    const filepath = join(process.cwd(), '.data', 'sde', 'extracted', `${options.table}.jsonl`)

    console.log(`\n📊 Inspecting ${options.table} (first ${limit} records)...\n`)

    try {
      let count = 0
      for await (const row of streamParseJSONLines(filepath)) {
        console.log(`Record ${count + 1}:`)
        console.log(JSON.stringify(row, null, 2))

        // Show extracted values for key fields
        if (row.name) {
          console.log(`\n  ✓ name extraction: "${extractLanguageField(row.name, 'en')}"`)
        }
        if (row.description) {
          console.log(`  ✓ description extraction: "${extractLanguageField(row.description, 'en')}"`)
        }
        if (row.position?.x !== undefined) {
          console.log(
            `  ✓ position.x type: ${typeof row.position.x} = ${row.position.x}`
          )
        }

        console.log('\n---\n')

        count++
        if (count >= limit) break
      }

      console.log(`✅ Inspected ${count} records`)
    } catch (error) {
      console.error('❌ Error:', error)
    }
  }
}
