import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { database } from './database';
import { logger } from './logger';
import chalk from 'chalk';

const MIGRATIONS_DIR = join(process.cwd(), 'db');

export interface Migration {
  version: number;
  name: string;
  upFile: string;
  downFile: string;
}

export async function getMigrations(): Promise<Migration[]> {
  const files = await readdir(MIGRATIONS_DIR);
  const migrations: Record<string, Partial<Migration>> = {};

  for (const file of files) {
    const match = file.match(/^(\d+)-(.+)\.(up|down)\.sql$/);
    if (match) {
      const [, versionStr, name, direction] = match;
      const version = parseInt(versionStr, 10);
      if (!migrations[version]) {
        migrations[version] = { version, name };
      }
      if (direction === 'up') {
        migrations[version].upFile = file;
      } else {
        migrations[version].downFile = file;
      }
    }
  }

  const migrationList = Object.values(migrations).filter(m => m.upFile && m.downFile) as Migration[];
  migrationList.sort((a, b) => a.version - b.version);
  return migrationList;
}

export async function getAppliedMigrations(): Promise<string[]> {
    await database.sql`CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    batch INTEGER NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );`;
  const applied = await database.sql<{ name: string }[]>`SELECT name FROM migrations ORDER BY id ASC`;
  return applied.map(m => m.name);
}

export async function getPendingMigrations(): Promise<Migration[]> {
  const allMigrations = await getMigrations();
  const appliedMigrations = await getAppliedMigrations();
  const appliedSet = new Set(appliedMigrations);
  return allMigrations.filter(m => !appliedSet.has(m.upFile));
}

export async function applyMigrations(): Promise<void> {
  const pending = await getPendingMigrations();

  if (pending.length === 0) {
    logger.info(chalk.green('No pending migrations to apply.'));
    return;
  }

  const latestBatch = await database.sql<{ max: number }[]>`SELECT COALESCE(MAX(batch), 0) as max FROM migrations`;
  const batch = latestBatch[0].max + 1;

  logger.info(chalk.blue(`Applying ${pending.length} migration(s) in batch ${batch}...`));

  for (const migration of pending) {
    try {
      const upSql = await readFile(join(MIGRATIONS_DIR, migration.upFile), 'utf-8');
      await database.sql.unsafe(upSql);
      await database.sql`INSERT INTO migrations (name, batch) VALUES (${migration.upFile}, ${batch})`;
      logger.info(chalk.green(`✓ Applied ${migration.upFile}`));
    } catch (e) {
      logger.error(chalk.red(`✗ Failed to apply ${migration.upFile}`), { error: String(e) });
      throw new Error(`Migration failed: ${migration.upFile}`);
    }
  }

  logger.info(chalk.green('All migrations applied successfully.'));
}

export async function rollbackLastBatch(): Promise<void> {
    const latestBatchResult = await database.sql<{ max: number }[]>`SELECT COALESCE(MAX(batch), 0) as max FROM migrations`;
    const latestBatch = latestBatchResult[0].max;

    if (latestBatch === 0) {
      logger.info(chalk.yellow('No migrations to roll back.'));
      return;
    }

    const migrationsToRollback = await database.sql<{ name: string }[]>`
      SELECT name FROM migrations WHERE batch = ${latestBatch} ORDER BY id DESC
    `;

  if (migrationsToRollback.length === 0) {
    logger.info(chalk.yellow('No migrations in the last batch to roll back.'));
    return;
  }

  logger.info(chalk.blue(`Rolling back ${migrationsToRollback.length} migration(s) from batch ${latestBatch}...`));

  const allMigrations = await getMigrations();
  const allMigrationsMap = new Map(allMigrations.map(m => [m.upFile, m]));

  for (const row of migrationsToRollback) {
    const migration = allMigrationsMap.get(row.name);
    if (!migration) {
        logger.error(chalk.red(`Migration ${row.name} not found in file system.`));
        continue;
    }
    try {
      const downSql = await readFile(join(MIGRATIONS_DIR, migration.downFile), 'utf-8');
      await database.sql.unsafe(downSql);
      await database.sql`DELETE FROM migrations WHERE name = ${migration.upFile}`;
      logger.info(chalk.green(`✓ Rolled back ${migration.upFile}`));
    } catch (e) {
      logger.error(chalk.red(`✗ Failed to roll back ${migration.upFile}`), { error: String(e) });
      throw new Error(`Rollback failed: ${migration.upFile}`);
    }
  }

  logger.info(chalk.green('Rollback completed successfully.'));
}

export async function rollbackTo(version: number): Promise<void> {
  const appliedMigrations = await getAppliedMigrations();
  const allMigrations = await getMigrations();
  const allMigrationsMap = new Map(allMigrations.map(m => [m.upFile, m]));

  const migrationsToRollback = appliedMigrations
    .map(name => allMigrationsMap.get(name))
    .filter((m): m is Migration => !!m)
    .filter(m => m.version > version)
    .sort((a, b) => b.version - a.version);

  if (migrationsToRollback.length === 0) {
    logger.info(chalk.yellow('No migrations to roll back to the specified version.'));
    return;
  }

  logger.info(chalk.blue(`Rolling back ${migrationsToRollback.length} migration(s) to version ${version}...`));

  for (const migration of migrationsToRollback) {
    try {
      const downSql = await readFile(join(MIGRATIONS_DIR, migration.downFile), 'utf-8');
      await database.sql`DELETE FROM migrations WHERE name = ${migration.upFile}`;
      await database.sql.unsafe(downSql);
      logger.info(chalk.green(`✓ Rolled back ${migration.upFile}`));
    } catch (e) {
      logger.error(chalk.red(`✗ Failed to roll back ${migration.upFile}`), { error: String(e) });
      throw new Error(`Rollback failed: ${migration.upFile}`);
    }
  }

  logger.info(chalk.green(`Rollback to version ${version} completed successfully.`));
}
