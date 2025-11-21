import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { database } from '../helpers/database'
import chalk from 'chalk'

/**
 * Schema Migration Plugin for Postgres
 *
 * This plugin handles idempotent database schema application by:
 * 1. Reading all SQL files from the db/ directory (ordered by filename)
 * 2. Calculating checksums for each file
 * 3. Comparing with stored checksums in the 'migrations' table
 * 4. Applying only changed migrations
 * 5. Handling schema evolution (adding new columns) automatically
 * 6. Updating checksums after successful migration
 */

const DATA_DIR = join(process.cwd(), '.data')
const CHECKSUM_FILE = join(DATA_DIR, 'schema-checksums.json')
const MIGRATIONS_DIR = join(process.cwd(), 'db')

interface FileChecksums {
  [filename: string]: string
}

interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
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

async function loadChecksumsFromDb(): Promise<FileChecksums> {
  try {
    const exists = await database.tableExists('migrations');
    if (!exists) return {};

    const rows = await database.query<{filename: string, checksum: string}>('SELECT DISTINCT ON (filename) filename, checksum FROM migrations ORDER BY filename, id DESC');
    const checksums: FileChecksums = {};
    for (const row of rows) {
      checksums[row.filename] = row.checksum;
    }
    return checksums;
  } catch (e) {
    console.error(chalk.yellow('⚠️  Failed to load checksums from DB:'), e);
    return {};
  }
}

async function saveChecksumToDb(filename: string, checksum: string, success: boolean = true) {
    try {
        const exists = await database.tableExists('migrations');
        if (!exists) {
             if (filename.includes('create-migrations-table')) {
                 // This is expected for the migration that creates the table
                 return;
             }
             console.warn(chalk.yellow(`⚠️  Cannot save checksum for ${filename}: 'migrations' table does not exist yet.`));
             return;
        }

        await database.execute(
            'INSERT INTO migrations (filename, checksum, success) VALUES ({filename:String}, {checksum:String}, {success:Boolean})',
            { filename, checksum, success }
        );
    } catch (e) {
        console.error(chalk.red(`Failed to save checksum for ${filename} to DB:`), e);
    }
}

/**
 * Parse a CREATE TABLE statement to extract table name and columns
 *
 * This is a simplified parser and may not handle all SQL complexities.
 * It assumes a relatively standard CREATE TABLE syntax.
 */
function parseCreateTable(statement: string): { tableName: string, columns: ColumnDefinition[] } | null {
  // Normalize whitespace
  const normalized = statement.replace(/\s+/g, ' ').trim()

  // Regex to find table name
  // Matches: CREATE TABLE [IF NOT EXISTS] "tableName" (
  // or CREATE TABLE [IF NOT EXISTS] tableName (
  const tableMatch = normalized.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+("?[^"\s(]+"?)\s*\(/i)
  if (!tableMatch) return null

  const tableName = tableMatch[1].replace(/"/g, '') // Remove quotes if present

  // Extract content inside parentheses
  // We need to find the matching closing parenthesis
  const startIndex = normalized.indexOf('(')
  if (startIndex === -1) return null

  let openCount = 0
  let endIndex = -1
  let inString = false
  let stringQuote = ''

  for (let i = startIndex; i < normalized.length; i++) {
      const char = normalized[i]

      if (!inString) {
          if (char === "'" || char === '"') {
              inString = true
              stringQuote = char
          } else if (char === '(') {
              openCount++
          } else if (char === ')') {
              openCount--
          }
      } else {
          // Handle escaped quotes? Simplistic check for now
          if (char === stringQuote) {
              inString = false
          }
      }

      if (openCount === 0 && i > startIndex) { // i > startIndex ensures we don't break on the first '('
          endIndex = i
          break
      }
  }

  if (endIndex === -1) return null

  const columnsContent = normalized.substring(startIndex + 1, endIndex)

  // Split columns by comma, but handle commas inside parentheses and strings
  const columns: string[] = []
  let current = ''
  let parenDepth = 0
  inString = false

  for (let i = 0; i < columnsContent.length; i++) {
    const char = columnsContent[i]

    if (!inString) {
        if (char === "'" || char === '"') {
            inString = true
            stringQuote = char
        } else if (char === '(') {
            parenDepth++
        } else if (char === ')') {
            parenDepth--
        } else if (char === ',' && parenDepth === 0) {
            columns.push(current.trim())
            current = ''
            continue
        }
    } else {
        if (char === stringQuote) {
            inString = false
        }
    }
    current += char
  }
  if (current.trim()) columns.push(current.trim())

  const columnDefinitions: ColumnDefinition[] = []

  for (const colDef of columns) {
    // Skip constraints like PRIMARY KEY (id), INDEX ..., UNIQUE ...
    if (/^(PRIMARY KEY|CONSTRAINT|INDEX|UNIQUE|CHECK|FOREIGN KEY)/i.test(colDef)) continue

    // Improved parsing for name and type
    // Name is first word (maybe quoted)
    const nameMatch = colDef.match(/^"([^"]+)"|^([a-zA-Z0-9_]+)/)
    if (!nameMatch) continue

    const name = nameMatch[1] || nameMatch[2]

    // Type follows name
    // We need to extract type which might contain spaces or parentheses
    let rest = colDef.substring(nameMatch[0].length).trim()

    // Extract type: assume it ends before DEFAULT, NOT NULL, NULL, CHECK, PRIMARY KEY, UNIQUE
    const typeEndMatch = rest.match(/\s+(DEFAULT|NOT NULL|NULL|CHECK|PRIMARY KEY|UNIQUE|REFERENCES)/i)
    let type = ''
    if (typeEndMatch) {
        type = rest.substring(0, typeEndMatch.index).trim()
        rest = rest.substring(typeEndMatch.index!) // Keep the constraints in rest
    } else {
        type = rest // No constraints
        rest = ''
    }

    if (!type) continue // Should have a type

    // Check for NOT NULL (default is nullable in SQL, but usually we want to know)
    const nullable = !/NOT NULL/i.test(rest)

    // Check for DEFAULT
    // This is still simplistic for complex defaults but handles basic ones
    let defaultValue: string | undefined
    const defaultMatch = rest.match(/DEFAULT\s+(.*)/i)
    if (defaultMatch) {
         defaultValue = defaultMatch[1].trim()

         // If there are trailing constraints like NOT NULL, we need to strip them
         // But we already stripped them above if they were separated by space!
         // The problem is my regex logic for typeEndMatch might have missed something
         // or "rest" here only contains the DEFAULT part and afterwards.

         // Wait, I split "rest" based on typeEndMatch.
         // If I had "INTEGER DEFAULT 'pending,active'", typeEndMatch matched "DEFAULT".
         // So "rest" now contains "DEFAULT 'pending,active'".

         // My simplified default matching was bad.
         // Let's take the part after DEFAULT
         const defaultVal = defaultMatch[1].trim();

         // It might be a string literal or number or keyword
         if (defaultVal.startsWith("'")) {
             // It's a string, find the closing quote
             // We know the parser logic respected quotes when extracting columns,
             // so this string should be safe/complete within this column definition.
             // But we might have trailing keywords if I missed them in typeEndMatch (unlikely given the list).
             defaultValue = defaultVal;
         } else {
             // It's a number or keyword (e.g. 0 or TRUE)
             defaultValue = defaultVal.split(' ')[0];
         }
    }
    // Better default handling needed if we want to support function calls like NOW() or expressions
    // But for now, we stick to simple string/number literals or single token keywords

    columnDefinitions.push({
      name,
      type,
      nullable,
      defaultValue
    })
  }

  return { tableName, columns: columnDefinitions }
}

/**
 * Sync table schema by adding missing columns
 */
async function syncTableSchema(statement: string) {
  const parsed = parseCreateTable(statement)
  if (!parsed) return

  const { tableName, columns } = parsed

  try {
    // Check if table exists
    const exists = await database.tableExists(tableName)
    if (!exists) return // Should have been created by the statement execution before calling this

    // Get current columns
    const currentColumns = await database.getTableSchema(tableName)
    // Postgres stores unquoted identifiers in lowercase.
    // We need to match case-insensitively unless we assume everything is lowercase or quoted.
    // For simplicity, we'll lowercase everything for comparison unless the definition uses quotes.
    // But our parseCreateTable strips quotes for name.
    const currentColumnMap = new Map(currentColumns.map(c => [c.name.toLowerCase(), c]))

    // Find missing columns
    for (const col of columns) {
      const existingCol = currentColumnMap.get(col.name.toLowerCase())

      if (!existingCol) {
        console.log(chalk.yellow(`⚠️  Column '${col.name}' missing in table '${tableName}', adding it...`))

        let alterSql = `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`

        // Add constraints if needed (simplistic)
        if (!col.nullable) {
             // If adding NOT NULL column to existing table, we need a default
             if (col.defaultValue) {
                 alterSql += ` DEFAULT ${col.defaultValue} NOT NULL`
             } else {
                 // Cannot add NOT NULL without default to populated table easily
                 // So we skip NOT NULL constraint for now or warn
                 console.warn(chalk.yellow(`   Warning: Adding NOT NULL column '${col.name}' without default value. Constraint might be omitted.`))
             }
        } else if (col.defaultValue) {
            alterSql += ` DEFAULT ${col.defaultValue}`
        }

        await database.execute(alterSql)
        console.log(chalk.green(`   ✓ Added column '${col.name}'`))
      } else {
          // Check for type mismatches (simplified check)
          // Note: comparing SQL types is hard because of aliases (int vs integer, varchar vs character varying)
          // We do a loose check or just log if it looks very different

          // Just logging for now as requested by "changes in fields"
          // Implementing auto-migration for types is dangerous

          // Normalize types for comparison (very basic)
          const normDefType = col.type.toLowerCase().split('(')[0].trim();
          const normDbType = existingCol.type.toLowerCase().split('(')[0].trim();

          // Some common aliases
          const aliases: Record<string, string> = {
              'int': 'integer',
              'int4': 'integer',
              'int8': 'bigint',
              'serial': 'integer',
              'varchar': 'character varying',
              'bool': 'boolean'
          }

          const type1 = aliases[normDefType] || normDefType
          const type2 = aliases[normDbType] || normDbType

          if (type1 !== type2 && !type2.includes(type1) && !type1.includes(type2)) {
              // Ignore array type mismatches (Postgres reports ARRAY for any array type)
              if (type2 === 'array' && type1.endsWith('[]')) {
                  continue
              }

              console.warn(chalk.yellow(`⚠️  Column '${col.name}' in table '${tableName}' has type mismatch.`))
              console.warn(chalk.gray(`   Defined: ${col.type}, Database: ${existingCol.type}`))
              console.warn(chalk.gray(`   Automatic type migration is skipped for safety.`))
          }
      }
    }
  } catch (e) {
    console.error(chalk.red(`Failed to sync schema for table ${tableName}:`), e)
    throw e; // Re-throw to stop migration
  }
}

export async function migrateSchema() {
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

      // Ensure we have a database connection
      const connected = await database.ping()
      if (!connected) {
        console.error(chalk.red('❌ Postgres not connected, skipping schema migration'))
        return
      }

      // Read stored checksums from DB (and file for backward compatibility/backup)
      let storedChecksums: FileChecksums = await loadChecksumsFromDb();

      // If DB is empty, try loading from file as a fallback (only for initial migration to DB storage)
      if (Object.keys(storedChecksums).length === 0 && existsSync(CHECKSUM_FILE)) {
        try {
            const fileChecksums = JSON.parse(readFileSync(CHECKSUM_FILE, 'utf-8'))
            // Merge file checksums, but only if they look valid
            if (fileChecksums) {
                storedChecksums = { ...fileChecksums, ...storedChecksums }
            }
        } catch (error) {
            // Ignore error
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
        return
      }

      console.log(chalk.yellow(`ℹ️  ${filesToMigrate.length} file(s) need migration`))

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
          const statements = splitSqlStatements(content)

          if (statements.length === 0) {
            console.log(chalk.yellow(`⚠ ${file}`) + chalk.gray(` (0ms, empty file)`))
            await saveChecksumToDb(file, currentChecksums[file], true);
            storedChecksums[file] = currentChecksums[file]
            totalSuccessCount++
            continue
          }

          // Execute each statement individually
          for (const statement of statements) {
            // Skip CREATE DATABASE statements as we are already connected to a DB
            if (statement.toUpperCase().startsWith('CREATE DATABASE') || statement.toUpperCase().includes('CREATE DATABASE')) {
                 continue;
            }

            // Attempt to execute the statement (e.g. CREATE TABLE)
            try {
                await database.execute(statement)
            } catch (e) {
                 // Ignore "already exists" errors for CREATE TABLE/INDEX, but re-throw others
                 const msg = e instanceof Error ? e.message : String(e);
                 if (!msg.includes('already exists')) {
                     throw e;
                 }
            }

            // If it's a CREATE TABLE statement, also check for schema sync
            // We do this even if the table already exists (the execution might have been skipped or failed with 'already exists')
            if (statement.toUpperCase().includes('CREATE TABLE')) {
                await syncTableSchema(statement);
            }
          }

          const fileElapsedTime = Date.now() - fileStartTime
          const timeStr = fileElapsedTime < 1000
            ? `${fileElapsedTime}ms`
            : `${(fileElapsedTime / 1000).toFixed(2)}s`

          console.log(chalk.green(`✓ ${file}`) + chalk.gray(` (${timeStr}, ${statements.length} statement${statements.length === 1 ? '' : 's'})`))

          // Update stored checksum for this file
          await saveChecksumToDb(file, currentChecksums[file], true);
          storedChecksums[file] = currentChecksums[file]
          totalSuccessCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const fileElapsedTime = Date.now() - fileStartTime
          const timeStr = fileElapsedTime < 1000
            ? `${fileElapsedTime}ms`
            : `${(fileElapsedTime / 1000).toFixed(2)}s`

          console.log(chalk.red(`✗ ${file}`) + chalk.gray(` (${timeStr})`))
          console.error(chalk.red(`   ❌ ${errorMessage.substring(0, 150)}`))
          totalErrorCount++
        }
      }

      console.log('') // Empty line

      if (totalErrorCount === 0) {
        console.log(chalk.green(`✅ Schema migration completed successfully (${totalSuccessCount} files)`))
        // Also update local JSON file as backup
        try {
            writeFileSync(CHECKSUM_FILE, JSON.stringify(storedChecksums, null, 2), 'utf-8')
        } catch (e) {}
      } else {
        console.log(chalk.yellow(`⚠️  Schema migration completed with errors (${totalSuccessCount} successful, ${totalErrorCount} failed)`))
      }

    } catch (error) {
      console.error(chalk.red('❌ Schema migration failed:'), error)
    }
}

export default async (nitroApp: any) => {
  // Wait a bit to ensure the database helper is initialized
  setTimeout(migrateSchema, 1000) // Wait 1 second for database connection to be established
}
