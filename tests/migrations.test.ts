import { describe, test, expect, beforeEach } from 'bun:test';
import { database } from '~/server/helpers/database';
import { applyMigrations, rollbackLastBatch, getAppliedMigrations, getMigrations, rollbackTo } from '~/server/helpers/migrator';

describe('migrations', () => {
  beforeEach(async () => {
    // Clean up all tables, views, and materialized views before each test
    await database.sql`DROP TABLE IF EXISTS migrations CASCADE`;
    await database.sql`DROP TABLE IF EXISTS config CASCADE`;
    await database.sql`DROP TABLE IF EXISTS killmails CASCADE`;
    await database.sql`DROP TABLE IF EXISTS attackers CASCADE`;
    await database.sql`DROP TABLE IF EXISTS items CASCADE`;
    await database.sql`DROP TABLE IF EXISTS characters CASCADE`;
    await database.sql`DROP TABLE IF EXISTS corporations CASCADE`;
    await database.sql`DROP TABLE IF EXISTS alliances CASCADE`;
    await database.sql`DROP TABLE IF EXISTS prices CASCADE`;
    await database.sql`DROP TABLE IF EXISTS regions CASCADE`;
    await database.sql`DROP TABLE IF EXISTS constellations CASCADE`;
    await database.sql`DROP TABLE IF EXISTS solarsystems CASCADE`;
    await database.sql`DROP TABLE IF EXISTS stargates CASCADE`;
    await database.sql`DROP TABLE IF EXISTS stars CASCADE`;
    await database.sql`DROP TABLE IF EXISTS planets CASCADE`;
    await database.sql`DROP TABLE IF EXISTS moons CASCADE`;
    await database.sql`DROP TABLE IF EXISTS asteroidBelts CASCADE`;
    await database.sql`DROP TABLE IF EXISTS categories CASCADE`;
    await database.sql`DROP TABLE IF EXISTS groups CASCADE`;
    await database.sql`DROP TABLE IF EXISTS types CASCADE`;
    await database.sql`DROP TABLE IF EXISTS marketGroups CASCADE`;
    await database.sql`DROP TABLE IF EXISTS metaGroups CASCADE`;
    await database.sql`DROP TABLE IF EXISTS npcCorporations CASCADE`;
    await database.sql`DROP TABLE IF EXISTS npcStations CASCADE`;
    await database.sql`DROP TABLE IF EXISTS npcCharacters CASCADE`;
    await database.sql`DROP TABLE IF EXISTS factions CASCADE`;
    await database.sql`DROP TABLE IF EXISTS races CASCADE`;
    await database.sql`DROP TABLE IF EXISTS bloodlines CASCADE`;
    await database.sql`DROP TABLE IF EXISTS ancestries CASCADE`;
    await database.sql`DROP TABLE IF EXISTS dogmaAttributes CASCADE`;
    await database.sql`DROP TABLE IF EXISTS dogmaEffects CASCADE`;
    await database.sql`DROP TABLE IF EXISTS skins CASCADE`;
    await database.sql`DROP TABLE IF EXISTS stationOperations CASCADE`;
    await database.sql`DROP MATERIALIZED VIEW IF EXISTS celestials CASCADE`;
    await database.sql`DROP MATERIALIZED VIEW IF EXISTS top_characters_weekly CASCADE`;
    await database.sql`DROP MATERIALIZED VIEW IF EXISTS top_corporations_weekly CASCADE`;
    await database.sql`DROP MATERIALIZED VIEW IF EXISTS top_alliances_weekly CASCADE`;
    await database.sql`DROP MATERIALIZED VIEW IF EXISTS top_systems_weekly CASCADE`;
    await database.sql`DROP MATERIALIZED VIEW IF EXISTS top_regions_weekly CASCADE`;
    await database.sql`DROP VIEW IF EXISTS kill_list CASCADE`;

    // Recreate the migrations table
    await database.sql`CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        batch INTEGER NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );`;
  });

  test('should apply all pending migrations', async () => {
    await applyMigrations();
    const applied = await getAppliedMigrations();
    const all = await getMigrations();
    expect(applied.length).toBe(all.length);
  });

  test('should rollback the last batch of migrations', async () => {
    await applyMigrations();
    await rollbackLastBatch();
    const applied = await getAppliedMigrations();
    expect(applied.length).toBe(0);
  });

  test('should rollback to a specific version', async () => {
    await applyMigrations();
    await rollbackTo(10);
    const applied = await getAppliedMigrations();
    const all = await getMigrations();
    const expected = all.filter(m => m.version <= 10).length;
    expect(applied.length).toBe(expected);
  });
});
