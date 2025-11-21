import { database } from '../helpers/database'

/**
 * Config Model
 * Stores application configuration and state tracking
 */

export interface Config {
  configKey: string
  configValue: string | null
  buildNumber: number | null
  tableName: string | null
  rowCount: number | null
  updatedAt: string | null
}

/**
 * Get a config value by key
 */
export async function getConfig(key: string): Promise<string | null> {
  const [row] = await database.sql<{ configValue: string }[]>`
    SELECT "configValue" FROM config WHERE "configKey" = ${key}
  `
  return row?.configValue ?? null
}

/**
 * Set a config value
 */
export async function setConfig(key: string, value: string): Promise<void> {
  const now = new Date()

  await database.sql`
    INSERT INTO config ("configKey", "configValue", "updatedAt")
    VALUES (${key}, ${value}, ${now})
    ON CONFLICT ("configKey")
    DO UPDATE SET
      "configValue" = ${value},
      "updatedAt" = ${now}
  `
}

/**
 * Get all config entries
 */
export async function getAllConfig(): Promise<Config[]> {
  return await database.sql<Config[]>`
    SELECT * FROM config ORDER BY "configKey"
  `
}

/**
 * Delete a config entry
 */
export async function deleteConfig(key: string): Promise<void> {
  await database.sql`
    DELETE FROM config WHERE "configKey" = ${key}
  `
}
