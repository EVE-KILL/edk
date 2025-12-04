import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { logger } from '../logger';

/**
 * SDE Parser - Handles JSON Lines format with special _key/_value encoding
 *
 * The SDE uses JSON Lines format where:
 * - Each line is a valid JSON object
 * - Integer keys are encoded as {_key: number, _value: value} pairs
 * - Nested objects/arrays have the same encoding
 */

interface SDERow {
  [key: string]: any;
}

/**
 * Normalize SDE row data
 * Converts _key/_value encoding to normal key-value pairs
 */
export function normalizeSDERow(row: any): SDERow {
  const normalized: SDERow = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === '_key') {
      // _key becomes the primary key
      normalized.id = value;
      normalized._key = value;
    } else if (key === '_value') {
      // _value is the value for this row (sometimes used for simple mappings)
      normalized._value = value;
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Process array items
        normalized[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? normalizeSDERow(item)
            : item
        );
      } else {
        // Recursively normalize nested objects
        normalized[key] = normalizeSDERow(value);
      }
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Stream parse JSON Lines file (for large files)
 * Yields one row at a time using readline for memory efficiency
 */
export async function* streamParseJSONLines(
  filepath: string
): AsyncGenerator<any> {
  const fileStream = createReadStream(filepath, { encoding: 'utf-8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);
      yield normalizeSDERow(data);
    } catch {
      logger.warn(
        `⚠️  Skipped invalid JSON line ${lineNum}: ${line.substring(0, 100)}...`
      );
    }
  }
}

/**
 * Extract nested language field (e.g., name.en, name.de)
 * Always returns a proper string, never [object Object]
 */
export function extractLanguageField(obj: any, lang: string = 'en'): string {
  // If it's already a string, return it
  if (typeof obj === 'string') {
    return obj;
  }

  // If it's an object with language keys
  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    // Try to get the requested language
    if (obj[lang] && typeof obj[lang] === 'string') {
      return obj[lang];
    }

    // Fall back to English
    if (obj.en && typeof obj.en === 'string') {
      return obj.en;
    }

    // Fall back to first available language key
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }

  // If we get here and it's an object, return empty string instead of [object Object]
  if (typeof obj === 'object' && obj !== null) {
    return '';
  }

  // For any other type, return empty string
  return '';
}

/**
 * Extract nested description field
 * Always returns a proper string, never [object Object]
 */
export function extractDescription(obj: any, lang: string = 'en'): string {
  return extractLanguageField(obj, lang);
}

/**
 * Convert boolean fields
 */
export function toBoolean(value: any): boolean {
  return !!value;
}

/**
 * Safe parse number
 */
export function parseNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}
