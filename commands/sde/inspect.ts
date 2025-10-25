import { readFile } from 'fs/promises'
import { sdeFetcher } from '../../server/helpers/sde'
import chalk from 'chalk'
import { logger } from '../../server/helpers/logger'

interface InspectionResult {
  tableName: string
  rowCount: number
  sampleRows: any[]
  fields: Map<string, Set<string>>
  schema: Map<string, string>
}

/**
 * Inspect a single SDE table
 *
 * Usage:
 *   bun run cli sde:inspect --table invTypes
 *   bun run cli sde:inspect --table mapSolarSystems --rows 5
 */
export default {
  description: 'Inspect SDE table structure and sample data',

  options: [
    {
      flags: '-t, --table <name>',
      description: 'Table name to inspect'
    },
    {
      flags: '-r, --rows <count>',
      description: 'Number of sample rows to display (default: 3)'
    }
  ],

  async action(options: any) {
    if (!options.table) {
      logger.error('Usage: bun run cli sde:inspect --table <name> [--rows <count>]')
      logger.error('Example: bun run cli sde:inspect --table invTypes')
      process.exit(1)
    }

    const tableName = options.table
    const sampleRowCount = parseInt(options.rows || '3', 10)

    logger.info(`Inspecting table: ${chalk.cyan(tableName)}`)

    try {
      // Check if table exists
      if (!sdeFetcher.tableExists(tableName)) {
        logger.error(`Table not found: ${chalk.red(tableName)}`)
        logger.info('Run "bun run cli sde:download" first to download SDE data')
        process.exit(1)
      }

      // Inspect the table
      const result = await inspectTable(tableName, sampleRowCount)

      // Display results
      displayInspectionResults(result)
    } catch (error) {
      logger.error('Error inspecting table:', { error: String(error) })
      process.exit(1)
    }
  }
}

/**
 * Inspect a table file
 */
async function inspectTable(tableName: string, sampleRowCount: number): Promise<InspectionResult> {
  const filepath = sdeFetcher.getTablePath(tableName)
  const content = await readFile(filepath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  const sampleRows: any[] = []
  const fields = new Map<string, Set<string>>()
  let rowCount = 0

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      rowCount++

      // Collect sample rows
      if (sampleRows.length < sampleRowCount) {
        sampleRows.push(data)
      }

      // Analyze field types
      analyzeObject(data, '', fields)
    } catch (error) {
      logger.warn(`Skipped invalid JSON line ${rowCount}`)
    }
  }

  // Infer schema from field analysis
  const schema = new Map<string, string>()
  for (const [field, types] of fields.entries()) {
    schema.set(field, inferType(Array.from(types)))
  }

  return {
    tableName,
    rowCount,
    sampleRows,
    fields,
    schema
  }
}

/**
 * Recursively analyze object structure
 */
function analyzeObject(
  obj: any,
  prefix: string,
  fields: Map<string, Set<string>>
): void {
  if (obj === null || obj === undefined) {
    return
  }

  if (typeof obj !== 'object') {
    const type = typeof obj
    const key = prefix || 'root'
    if (!fields.has(key)) {
      fields.set(key, new Set())
    }
    fields.get(key)!.add(type)
    return
  }

  if (Array.isArray(obj)) {
    const key = prefix || 'root'
    if (!fields.has(key)) {
      fields.set(key, new Set())
    }
    fields.get(key)!.add('array')
    return
  }

  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    analyzeObject(v, key, fields)
  }
}

/**
 * Infer ClickHouse type from JavaScript types
 */
function inferType(types: string[]): string {
  const typeSet = new Set(types)

  // Handle nullable
  const isNullable = typeSet.has('object') || types.some(t => t === 'null')

  if (typeSet.has('array')) {
    if (typeSet.size === 1) {
      return 'Array(Unknown)'
    }
    return 'Array(Variant)'
  }

  if (typeSet.size > 1 || isNullable) {
    if (typeSet.has('number')) return 'Nullable(Float64)'
    if (typeSet.has('boolean')) return 'Nullable(UInt8)'
    if (typeSet.has('string')) return 'Nullable(String)'
    return 'Nullable(String)'
  }

  const type = Array.from(typeSet)[0]

  switch (type) {
    case 'number':
      return 'UInt32' // Adjust based on value ranges
    case 'boolean':
      return 'UInt8'
    case 'string':
      return 'String'
    case 'array':
      return 'Array(String)'
    default:
      return 'String'
  }
}

/**
 * Display inspection results nicely
 */
function displayInspectionResults(result: InspectionResult): void {
  logger.info(`Table: ${chalk.cyan(result.tableName)}`, {
    rows: result.rowCount.toLocaleString(),
    fields: result.schema.size
  })

  // Display schema
  logger.info('Schema:')
  const sortedFields = Array.from(result.schema.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  for (const [field, type] of sortedFields) {
    logger.debug(`${field.padEnd(35)} ${chalk.yellow(type)}`)
  }

  // Display sample data
  if (result.sampleRows.length > 0) {
    logger.info(`Sample Data (${chalk.blue(result.sampleRows.length.toString())} rows):`)

    for (let i = 0; i < result.sampleRows.length; i++) {
      logger.debug(`Row ${i + 1}:`, result.sampleRows[i])
    }
  }

  // Display field types distribution
  logger.info('Type Distribution:')
  for (const [field, types] of result.fields.entries()) {
    if (types.size > 1) {
      logger.debug(`${field.padEnd(35)} ${chalk.magenta(`[${Array.from(types).join(', ')}]`)}`)
    }
  }
}
