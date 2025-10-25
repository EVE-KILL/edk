import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { database } from '../helpers/database'

/**
 * Schema Migration Plugin for ClickHouse
 *
 * This plugin handles idempotent database schema application by:
 * 1. Reading the schema.sql file
 * 2. Calculating its checksum
 * 3. Comparing with the stored checksum in .data/schema.checksum
 * 4. Applying it only if checksums don't match
 * 5. Updating the checksum file after successful migration
 */

const DATA_DIR = join(process.cwd(), '.data')
const CHECKSUM_FILE = join(DATA_DIR, 'schema.checksum')

export default async (nitroApp: any) => {
  // Wait a bit to ensure the database helper is initialized
  setTimeout(async () => {
    try {
      console.log('🔧 Starting schema migration...')

      // Ensure .data directory exists
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true })
      }

      // Read the schema file
      const schemaPath = join(process.cwd(), 'schema.sql')
      let schemaContent: string

      try {
        schemaContent = readFileSync(schemaPath, 'utf-8')
      } catch (error) {
        console.error('❌ Failed to read schema.sql:', error)
        return
      }

      // Calculate checksum of the schema file
      const currentChecksum = createHash('sha256').update(schemaContent).digest('hex')
      console.log(`📋 Schema checksum: ${currentChecksum.substring(0, 12)}...`)

      // Read the stored checksum from file
      let storedChecksum = ''
      if (existsSync(CHECKSUM_FILE)) {
        try {
          storedChecksum = readFileSync(CHECKSUM_FILE, 'utf-8').trim()
        } catch (error) {
          console.error('⚠️  Failed to read stored checksum:', error)
        }
      }

      console.log(`📊 Migration check:`, {
        current: currentChecksum.substring(0, 12),
        stored: storedChecksum.substring(0, 12) || 'none',
        match: currentChecksum === storedChecksum
      })

      // If checksums match, skip migration
      if (storedChecksum && currentChecksum === storedChecksum) {
        console.log(`✅ Schema is up to date (no changes detected)`)

        // Show current table count
        const connected = await database.ping()
        if (connected) {
          const tables = await database.query(`
            SELECT name FROM system.tables
            WHERE database = {database:String}
            ORDER BY name
          `, { database: process.env.CLICKHOUSE_DB || 'edk' })

          console.log(`📊 Database contains ${tables.length} tables`)
        }
        return
      }

      if (storedChecksum) {
        console.log('ℹ️  Schema has changed - applying migration...')
      } else {
        console.log('ℹ️  First time setup - applying migration...')
      }

      // Ensure we have a database connection
      const connected = await database.ping()
      if (!connected) {
        console.error('❌ ClickHouse not connected, skipping schema migration')
        return
      }

      console.log('🔄 Applying schema migration...')

      // Split the schema into individual statements
      // Remove comments and empty lines first
      const cleanContent = schemaContent
        .split('\n')
        .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
        .join('\n')

      const statements = cleanContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0)

      console.log(`📝 Found ${statements.length} SQL statements to execute`)

      let successCount = 0
      let errorCount = 0

      // Apply each statement
      for (const [index, statement] of statements.entries()) {
        try {
          console.log(`⚙️  Executing statement ${index + 1}/${statements.length}`)
          await database.execute(statement)
          successCount++
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`❌ Failed to execute statement ${index + 1}:`, errorMessage)
          console.error(`Statement: ${statement.substring(0, 200)}...`)

          // For non-critical errors (like table already exists), continue
          if (errorMessage.includes('already exists') ||
              errorMessage.includes('Code: 57') || // Table already exists
              errorMessage.includes('Code: 82')) { // Database already exists
            console.log('ℹ️  Continuing (table/database already exists)')
            successCount++
          } else {
            // For critical errors, stop execution
            throw error
          }
        }
      }

      if (errorCount === 0) {
        console.log(`✅ Schema migration completed successfully (${successCount} statements)`)
      } else {
        console.log(`⚠️  Schema migration completed with warnings (${successCount} successful, ${errorCount} errors)`)
      }

      // Save the checksum to file only if migration was successful
      if (errorCount === 0) {
        try {
          writeFileSync(CHECKSUM_FILE, currentChecksum, 'utf-8')
          console.log(`� Schema checksum saved to ${CHECKSUM_FILE}`)
        } catch (error) {
          console.error('❌ Failed to save checksum:', error)
        }
      }

      // Verify some key tables exist
      const tables = await database.query(`
        SELECT name FROM system.tables
        WHERE database = {database:String}
        ORDER BY name
      `, { database: process.env.CLICKHOUSE_DB || 'edk' })

      console.log(`📊 Database contains ${tables.length} tables`)

    } catch (error) {
      console.error('❌ Schema migration failed:', error)
    }
  }, 1000) // Wait 1 second for database connection to be established
}
