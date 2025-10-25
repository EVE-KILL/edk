import { readFile } from 'fs/promises'

/**
 * SDE Parser - Handles JSON Lines format with special _key/_value encoding
 *
 * The SDE uses JSON Lines format where:
 * - Each line is a valid JSON object
 * - Integer keys are encoded as {_key: number, _value: value} pairs
 * - Nested objects/arrays have the same encoding
 */

interface SDERow {
  [key: string]: any
}

/**
 * Normalize SDE row data
 * Converts _key/_value encoding to normal key-value pairs
 */
export function normalizeSDERow(row: any): SDERow {
  const normalized: SDERow = {}

  for (const [key, value] of Object.entries(row)) {
    if (key === '_key') {
      // _key becomes the primary key
      normalized.id = value
      normalized._key = value
    } else if (key === '_value') {
      // _value is the value for this row (sometimes used for simple mappings)
      normalized._value = value
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Process array items
        normalized[key] = value.map(item =>
          typeof item === 'object' && item !== null ? normalizeSDERow(item) : item
        )
      } else {
        // Recursively normalize nested objects
        normalized[key] = normalizeSDERow(value)
      }
    } else {
      normalized[key] = value
    }
  }

  return normalized
}

/**
 * Parse JSON Lines file
 */
export async function parseJSONLines(filepath: string): Promise<any[]> {
  const content = await readFile(filepath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  const rows: any[] = []
  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      rows.push(normalizeSDERow(data))
    } catch (error) {
      console.warn(`⚠️  Skipped invalid JSON line: ${line.substring(0, 100)}...`)
    }
  }

  return rows
}

/**
 * Stream parse JSON Lines file (for large files)
 * Yields one row at a time
 */
export async function* streamParseJSONLines(filepath: string): AsyncGenerator<any> {
  const content = await readFile(filepath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  for (let i = 0; i < lines.length; i++) {
    try {
      const data = JSON.parse(lines[i])
      yield normalizeSDERow(data)
    } catch (error) {
      console.warn(`⚠️  Skipped invalid JSON line ${i + 1}: ${lines[i].substring(0, 100)}...`)
    }
  }
}

/**
 * Extract nested language field (e.g., name.en, name.de)
 */
export function extractLanguageField(obj: any, lang: string = 'en'): string {
  if (typeof obj === 'string') {
    return obj
  }
  if (typeof obj === 'object' && obj !== null) {
    // Try to get the language version
    if (obj[lang]) {
      return obj[lang]
    }
    // Fall back to English
    if (obj.en) {
      return obj.en
    }
    // Fall back to first available language
    const values = Object.values(obj).filter(v => typeof v === 'string')
    return (values[0] as string) || String(obj)
  }
  return String(obj)
}

/**
 * Extract nested description field
 */
export function extractDescription(obj: any, lang: string = 'en'): string {
  return extractLanguageField(obj, lang)
}

/**
 * Convert boolean fields
 */
export function toBoolean(value: any): number {
  return value ? 1 : 0
}

/**
 * Safe parse number
 */
export function parseNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? defaultValue : parsed
  }
  return defaultValue
}
