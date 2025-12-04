import { database } from '../helpers/database';

/**
 * Config Model
 * Stores application configuration and state tracking
 */

export interface Config {
  configKey: string;
  configValue: string | null;
  buildNumber: number | null;
  tableName: string | null;
  rowCount: number | null;
  updatedAt: string | null;
}

/**
 * Get a config value by key
 */
export async function getConfig(key: string): Promise<string | null> {
  const row = await database.findOne<{ configValue: string }>(
    'SELECT "configValue" FROM config WHERE "configKey" = :key',
    { key }
  );
  return row?.configValue ?? null;
}

/**
 * Set a config value
 */
export async function setConfig(key: string, value: string): Promise<void> {
  const now = new Date();

  await database.execute(
    `INSERT INTO config ("configKey", "configValue", "updatedAt")
     VALUES (:key, :value, :now)
     ON CONFLICT ("configKey")
     DO UPDATE SET
       "configValue" = :value,
       "updatedAt" = :now`,
    { key, value, now }
  );
}

/**
 * Get all config entries
 */
export async function getAllConfig(): Promise<Config[]> {
  return database.find<Config>('SELECT * FROM config ORDER BY "configKey"');
}

/**
 * Delete a config entry
 */
export async function deleteConfig(key: string): Promise<void> {
  await database.execute('DELETE FROM config WHERE "configKey" = :key', {
    key,
  });
}
