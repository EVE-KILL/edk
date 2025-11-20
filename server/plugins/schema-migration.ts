import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { database } from '../helpers/database'
import chalk from 'chalk'

/**
 * Schema Migration Plugin for ClickHouse
 *
 * This plugin handles idempotent database schema application by:
 * 1. Reading all SQL files from the db/ directory (ordered by filename)
 * 2. Calculating checksums for each file
 * 3. Comparing with stored checksums in .data/schema-checksums.json
 * 4. Applying only changed migrations
 * 5. Updating checksums after successful migration
 *
 * SQL files are executed in alphabetical order based on their filename prefix:
 * - 01-create-database.sql
 * - 02-create-migrations-table.sql
 * - 10-create-killmail-tables.sql
 * - etc.
 */

const DATA_DIR = join(process.cwd(), '.data')
const CHECKSUM_FILE = join(DATA_DIR, 'schema-checksums.json')
const MIGRATIONS_DIR = join(process.cwd(), 'db')

interface FileChecksums {
  [filename: string]: string
}

/**
 * Split SQL content into individual statements
 * Handles multiple statements separated by semicolons,
 * SQL comments (line and block), empty lines, and whitespace.
 */
function splitSqlStatements(content: string): string[] {
  const statements: string[] = []
  let currentStatement = ''
  let inBlockComment = false
  let inString = false
  let stringDelimiter = ''

  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    let processedLine = ''

    // Process line character by character to handle comments and strings
    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      const nextChar = j + 1 < line.length ? line[j + 1] : ''
      const prevChar = j > 0 ? line[j - 1] : ''

      // Handle block comments
      if (!inString && char === '/' && nextChar === '*') {
        inBlockComment = true
        j++ // Skip the *
        continue
      }
      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false
        j++ // Skip the /
        continue
      }
      if (inBlockComment) {
        continue
      }

      // Handle line comments
      if (!inString && char === '-' && nextChar === '-') {
        // Rest of line is a comment
        break
      }

      // Handle strings
      if (!inString && (char === "'" || char === '"')) {
        inString = true
        stringDelimiter = char
        processedLine += char
        continue
      }
      if (inString && char === stringDelimiter && prevChar !== '\\') {
        inString = false
        stringDelimiter = ''
        processedLine += char
        continue
      }

      processedLine += char
    }

    // Add processed line to current statement
    if (processedLine.trim().length > 0) {
      currentStatement += processedLine + '\n'
    }
  }

  // Split by semicolons (now that comments are removed)
  const parts = currentStatement.split(';')

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.length > 0) {
      statements.push(trimmed)
    }
  }

  return statements
}

export default async (nitroApp: any) => {
  // Wait a bit to ensure the database helper is initialized
  setTimeout(async () => {
    try {
      console.log(chalk.blue('🔧 Starting schema migration...'))

      // Ensure .data directory exists
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true })
      }

      // Check if migrations directory exists
      if (!existsSync(MIGRATIONS_DIR)) {
        console.error(chalk.red(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`))
        return
      }

      // Read all SQL files from migrations directory, sorted by filename
      const migrationFiles = readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort()

      if (migrationFiles.length === 0) {
        console.error(chalk.red('❌ No migration files found in db/ directory'))
        return
      }

      console.log(chalk.cyan(`📁 Found ${migrationFiles.length} migration files`))

      // Read stored checksums
      let storedChecksums: FileChecksums = {}
      if (existsSync(CHECKSUM_FILE)) {
        try {
          storedChecksums = JSON.parse(readFileSync(CHECKSUM_FILE, 'utf-8'))
        } catch (error) {
          console.error(chalk.yellow('⚠️  Failed to read stored checksums:'), error)
        }
      }

      // Calculate current checksums and find files that need migration
      const currentChecksums: FileChecksums = {}
      const filesToMigrate: string[] = []

      for (const file of migrationFiles) {
        const filePath = join(MIGRATIONS_DIR, file)
        const content = readFileSync(filePath, 'utf-8')
        const checksum = createHash('sha256').update(content).digest('hex')
        currentChecksums[file] = checksum

        // If checksum doesn't match or file is new, mark for migration
        if (!storedChecksums[file] || storedChecksums[file] !== checksum) {
          filesToMigrate.push(file)
        }
      }

      // If no files need migration, skip
      if (filesToMigrate.length === 0) {
        console.log(chalk.green(`✅ Schema is up to date (no changes detected)`))

        // Show current table count
        const connected = await database.ping()
        if (connected) {
          const tables = await database.query(`
            SELECT name FROM system.tables
            WHERE database = {database:String}
            ORDER BY name
          `, { database: process.env.CLICKHOUSE_DB || 'edk' })

          console.log(chalk.gray(`📊 Database contains ${tables.length} tables`))
        }
        return
      }

      console.log(chalk.yellow(`ℹ️  ${filesToMigrate.length} file(s) need migration`))

      // Ensure we have a database connection
      const connected = await database.ping()
      if (!connected) {
        console.error(chalk.red('❌ ClickHouse not connected, skipping schema migration'))
        return
      }

      console.log(chalk.blue('🔄 Applying schema migration...\n'))

      let totalSuccessCount = 0
      let totalErrorCount = 0

      // Process each file that needs migration
      for (const file of filesToMigrate) {
        const fileStartTime = Date.now()
        const filePath = join(MIGRATIONS_DIR, file)
        const content = readFileSync(filePath, 'utf-8')

        try {
          // Split the file into individual SQL statements
          // ClickHouse HTTP interface doesn't support multi-statement queries
          const statements = splitSqlStatements(content)

          if (statements.length === 0) {
            console.log(chalk.yellow(`⚠ ${file}`) + chalk.gray(` (0ms, empty file)`))
            storedChecksums[file] = currentChecksums[file]
            totalSuccessCount++
            continue
          }

          // Execute each statement individually
          for (const statement of statements) {
            await database.execute(statement)
          }

          const fileElapsedTime = Date.now() - fileStartTime
          const timeStr = fileElapsedTime < 1000
            ? `${fileElapsedTime}ms`
            : `${(fileElapsedTime / 1000).toFixed(2)}s`

          console.log(chalk.green(`✓ ${file}`) + chalk.gray(` (${timeStr}, ${statements.length} statement${statements.length === 1 ? '' : 's'})`))

          // Update stored checksum for this file
          storedChecksums[file] = currentChecksums[file]
          totalSuccessCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const fileElapsedTime = Date.now() - fileStartTime
          const timeStr = fileElapsedTime < 1000
            ? `${fileElapsedTime}ms`
            : `${(fileElapsedTime / 1000).toFixed(2)}s`

          // For non-critical errors (like table already exists), treat as success
          if (errorMessage.includes('already exists') ||
              errorMessage.includes('Code: 57') || // Table already exists
              errorMessage.includes('Code: 82')) { // Database already exists
            console.log(chalk.green(`✓ ${file}`) + chalk.gray(` (${timeStr}, already exists)`))
            storedChecksums[file] = currentChecksums[file]
            totalSuccessCount++
          } else {
            console.log(chalk.red(`✗ ${file}`) + chalk.gray(` (${timeStr})`))
            console.error(chalk.red(`   ❌ ${errorMessage.substring(0, 150)}`))
            totalErrorCount++
          }
        }
      }

      console.log('') // Empty line

      if (totalErrorCount === 0) {
        console.log(chalk.green(`✅ Schema migration completed successfully (${totalSuccessCount} files)`))

        // Save all checksums to file
        try {
          writeFileSync(CHECKSUM_FILE, JSON.stringify(storedChecksums, null, 2), 'utf-8')
        } catch (error) {
          console.error(chalk.red('❌ Failed to save checksums:'), error)
        }
      } else {
        console.log(chalk.yellow(`⚠️  Schema migration completed with errors (${totalSuccessCount} successful, ${totalErrorCount} failed)`))
      }

      // Verify some key tables exist
      const tables = await database.query(`
        SELECT name FROM system.tables
        WHERE database = {database:String}
        ORDER BY name
      `, { database: process.env.CLICKHOUSE_DB || 'edk' })

      console.log(chalk.gray(`📊 Database contains ${tables.length} tables\n`))

    } catch (error) {
      console.error(chalk.red('❌ Schema migration failed:'), error)
    }
  }, 1000) // Wait 1 second for database connection to be established
}
