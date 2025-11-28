import { logger } from '../logger';

import { mkdir, readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { database } from '../database';
import {
  streamParseJSONLines,
  extractLanguageField,
  toBoolean,
  parseNumber,
} from './parser';
import type { TableConfig } from './types';

/**
 * SDE Fetcher - Downloads and manages EVE-Online Static Data Export
 *
 * Features:
 * - Fetches latest build number from CCP
 * - Downloads SDE zip with ETag support (skips if not modified)
 * - Extracts and caches locally
 * - Tracks metadata (build number, timestamp, ETag)
 */

interface SDEMetadata {
  buildNumber: number;
  url: string;
  eTag?: string;
  lastModified?: string;
  downloadedAt: number;
  extractedAt?: number;
  variant: 'jsonl' | 'yaml';
}

const SDE_BASE_URL = 'https://developers.eveonline.com/static-data/tranquility';
const SDE_LATEST_BUILD_URL = `${SDE_BASE_URL}/latest.jsonl`;
const SDE_DATA_DIR = join(process.cwd(), '.data', 'sde');
const SDE_DOWNLOADS_DIR = join(SDE_DATA_DIR, 'downloads');
const SDE_EXTRACTED_DIR = join(SDE_DATA_DIR, 'extracted');
const METADATA_FILE = join(SDE_DATA_DIR, 'metadata.json');

export class SDEFetcher {
  private forceReimport = false;

  /**
   * Enable force reimport mode
   * Allows re-importing all tables even if they've already been imported
   * Useful for testing deduplication and handling SDE version updates
   */
  enableForceReimport(): void {
    this.forceReimport = true;
    logger.info('⚠️  Force reimport mode enabled - will re-import all tables');
  }

  /**
   * Disable force reimport mode
   */
  disableForceReimport(): void {
    this.forceReimport = false;
    logger.info('✅ Force reimport mode disabled');
  }
  /**
   * Ensure directories exist
   */
  private async ensureDirectories(): Promise<void> {
    await mkdir(SDE_DATA_DIR, { recursive: true });
    await mkdir(SDE_DOWNLOADS_DIR, { recursive: true });
    await mkdir(SDE_EXTRACTED_DIR, { recursive: true });
  }

  /**
   * Load metadata from file
   */
  private async loadMetadata(): Promise<SDEMetadata | null> {
    try {
      if (!existsSync(METADATA_FILE)) {
        return null;
      }
      const data = await readFile(METADATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to load metadata:', error);
      return null;
    }
  }

  /**
   * Save metadata to file
   */
  private async saveMetadata(metadata: SDEMetadata): Promise<void> {
    await writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
  }

  /**
   * Fetch latest build number and download URL
   */
  async getLatestBuild(): Promise<{ buildNumber: number; url: string }> {
    logger.info('📡 Fetching latest SDE build number...');

    try {
      const response = await fetch(SDE_LATEST_BUILD_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch latest build: ${response.statusText}`);
      }

      // Parse JSON Lines - we only need the first line with key "sde"
      const text = await response.text();
      const lines = text.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const data = JSON.parse(line);
        if (data._key === 'sde' || data.key === 'sde') {
          const buildNumber = data._value || data.buildNumber;
          const variant = 'jsonl'; // We're using JSON Lines format
          const url = `${SDE_BASE_URL}/eve-online-static-data-${buildNumber}-${variant}.zip`;

          logger.info(`✅ Latest build: ${buildNumber}`);
          return { buildNumber, url };
        }
      }

      throw new Error('Could not find build number in latest.jsonl response');
    } catch (error) {
      logger.error('❌ Error fetching latest build:', error);
      throw error;
    }
  }

  /**
   * Download SDE zip file with ETag support
   */
  private async downloadSDE(
    url: string,
    buildNumber: number
  ): Promise<{ file: string; eTag?: string; lastModified?: string }> {
    const filename = `eve-online-static-data-${buildNumber}-jsonl.zip`;
    const filepath = join(SDE_DOWNLOADS_DIR, filename);

    logger.info(`📥 Downloading SDE (${buildNumber})...`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      // Get headers for caching support
      const eTag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      const contentLength = response.headers.get('content-length');

      if (contentLength) {
        const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
        logger.info(`   Size: ${sizeMB} MB`);
      }

      // Write to file
      const buffer = await response.arrayBuffer();
      await writeFile(filepath, new Uint8Array(buffer));

      logger.info(`✅ Downloaded: ${filename}`);

      return {
        file: filepath,
        eTag: eTag || undefined,
        lastModified: lastModified || undefined,
      };
    } catch (error) {
      logger.error('❌ Error downloading SDE:', error);
      throw error;
    }
  }

  /**
   * Extract zip file
   */
  private async extractZip(filepath: string, outputDir: string): Promise<void> {
    logger.info('📦 Extracting SDE zip...');

    try {
      const filename = basename(filepath);

      // Use system unzip command (more reliable than Node.js zip libraries)
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Extract
      await execAsync(`unzip -q "${filepath}" -d "${outputDir}"`);

      logger.info(`✅ Extracted: ${filename}`);
    } catch (error) {
      logger.error('❌ Error extracting SDE:', error);
      throw error;
    }
  }

  /**
   * List extracted table files
   */
  async listExtractedTables(): Promise<string[]> {
    try {
      if (!existsSync(SDE_EXTRACTED_DIR)) {
        return [];
      }

      const { readdirSync } = await import('fs');
      const files = readdirSync(SDE_EXTRACTED_DIR);

      return files.filter((f) => f.endsWith('.jsonl')).sort();
    } catch (error) {
      logger.error('Error listing tables:', error);
      return [];
    }
  }

  /**
   * Get path to extracted table file
   */
  getTablePath(tableName: string): string {
    return join(SDE_EXTRACTED_DIR, `${tableName}.jsonl`);
  }

  /**
   * Check if table exists locally
   */
  tableExists(tableName: string): boolean {
    const path = this.getTablePath(tableName);
    return existsSync(path);
  }

  /**
   * Main sync method - downloads if needed, returns metadata
   */
  async sync(): Promise<SDEMetadata> {
    await this.ensureDirectories();

    // Get latest build info (fallback to cached metadata if offline)
    let buildNumber: number | null = null;
    let url: string | null = null;
    try {
      const latest = await this.getLatestBuild();
      buildNumber = latest.buildNumber;
      url = latest.url;
    } catch (error) {
      logger.warn(
        '⚠️  Could not fetch latest build, falling back to cached metadata if available',
        error
      );
      const cached = await this.loadMetadata();
      if (!cached) {
        throw error;
      }
      buildNumber = cached.buildNumber;
      url = cached.url;
    }

    // Load existing metadata
    let metadata = await this.loadMetadata();

    // Check if we need to download
    if (metadata && buildNumber && metadata.buildNumber === buildNumber) {
      logger.info(`✅ Already have build ${buildNumber}`);
      return metadata;
    }

    // Download
    if (!buildNumber || !url) {
      throw new Error('No build information available to download SDE');
    }
    const { file, eTag, lastModified } = await this.downloadSDE(
      url,
      buildNumber
    );

    // Extract
    await this.extractZip(file, SDE_EXTRACTED_DIR);

    // Save metadata
    metadata = {
      buildNumber,
      url,
      eTag,
      lastModified,
      downloadedAt: Date.now(),
      extractedAt: Date.now(),
      variant: 'jsonl',
    };

    await this.saveMetadata(metadata);

    return metadata;
  }

  /**
   * Get current metadata
   */
  async getMetadata(): Promise<SDEMetadata | null> {
    return await this.loadMetadata();
  }

  /**
   * Clean up old downloads (keep latest 2)
   */
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up old SDE downloads...');

    try {
      const { readdirSync } = await import('fs');
      const files = readdirSync(SDE_DOWNLOADS_DIR)
        .filter((f) => f.endsWith('.zip'))
        .sort()
        .reverse();

      // Keep latest 2 versions
      for (let i = 2; i < files.length; i++) {
        const filepath = join(SDE_DOWNLOADS_DIR, files[i]);
        await rm(filepath);
        logger.info(`   Deleted: ${files[i]}`);
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Check if a table has already been imported for the current build
   */
  private async isTableAlreadyImported(
    tableName: string,
    buildNumber: number
  ): Promise<boolean> {
    try {
      const result = await database.findOne<{ configValue: string }>(
        `SELECT "configValue" FROM config
           WHERE "configKey" = :configKey AND "buildNumber" = :buildNumber
           LIMIT 1`,
        { configKey: `sde_imported_${tableName}`, buildNumber }
      );
      return result !== null;
    } catch {
      // If query fails, assume not imported
      return false;
    }
  }

  /**
   * Mark a table as imported for the current build
   */
  private async markTableAsImported(
    tableName: string,
    buildNumber: number,
    rowCount: number
  ): Promise<void> {
    try {
      const now = new Date();

      await database.bulkUpsert(
        'config',
        [
          {
            configKey: `sde_imported_${tableName}`,
            configValue: 'imported',
            buildNumber,
            tableName,
            rowCount,
            updatedAt: now,
          },
        ],
        ['configKey']
      );
    } catch (error) {
      logger.error(`⚠️  Failed to mark ${tableName} as imported:`, error);
      // Don't throw - import succeeded even if we can't mark it
    }
  }

  /**
   * Optimize tables to merge parts and deduplicate ReplacingMergeTree rows
   * Keeps the latest version of each row based on the version field
   */
  async optimizeViews(): Promise<void> {
    try {
      logger.info('🔧 Optimizing tables...');

      // List of all SDE tables to optimize
      const tables = [
        'solarSystems',
        'regions',
        'constellations',
        'stargates',
        'stars',
        'planets',
        'moons',
        'asteroidBelts',
        'types',
        'groups',
        'categories',
        'npcCorporations',
        'npcStations',
        'stationOperations',
        'npcCharacters',
        'factions',
        'races',
        'bloodlines',
        'ancestries',
        'marketGroups',
        'metaGroups',
        'skins',
        'dogmaAttributes',
        'dogmaEffects',
        'typeMaterials',
        'blueprints',
        'blueprintActivities',
        'blueprintMaterials',
        'blueprintProducts',
        'blueprintSkills',
      ];

      for (const table of tables) {
        // Use VACUUM ANALYZE for Postgres
        await database.execute(
          `VACUUM ANALYZE ${database.identifier(table.toLowerCase())}`
        );
      }
      logger.info(`   ✓ Optimized ${tables.length} SDE tables`);
    } catch (error) {
      logger.warn('⚠️  Failed to optimize tables:', error);
      // Don't throw - optimization is not critical
    }
  }

  /**
   * Import typeMaterials into Postgres
   */
  async importTypeMaterials(buildNumber?: number): Promise<void> {
    // Resolve build number
    if (!buildNumber) {
      const metadata = await this.getMetadata();
      if (!metadata) {
        logger.error('❌ No build number available for typeMaterials');
        return;
      }
      buildNumber = metadata.buildNumber;
    }

    if (!this.forceReimport) {
      const alreadyImported = await this.isTableAlreadyImported(
        'typeMaterials',
        buildNumber
      );
      if (alreadyImported) {
        logger.info(
          `⏭️  Skipping typeMaterials (already imported for build ${buildNumber})`
        );
        return;
      }
    }

    logger.info('📥 Importing typeMaterials...');
    const filepath = this.getTablePath('typeMaterials');
    if (!existsSync(filepath)) {
      logger.error(`❌ typeMaterials.jsonl not found at ${filepath}`);
      return;
    }

    const BATCH_SIZE = 1000;
    const records: any[] = [];
    let imported = 0;

    try {
      for await (const row of streamParseJSONLines(filepath)) {
        const typeId = row._key || row.typeID || row.typeId;
        if (!typeId || !row.materials || row.materials.length === 0) {
          continue;
        }

        for (const material of row.materials) {
          const materialTypeId =
            material.materialTypeID || material.typeID || material.typeId;
          if (!materialTypeId) continue;

          records.push({
            typeId: Number(typeId),
            materialTypeId: Number(materialTypeId),
            quantity: Number(material.quantity) || 0,
          });

          if (records.length >= BATCH_SIZE) {
            await database.bulkUpsert('typematerials', records, [
              'typeId',
              'materialTypeId',
            ]);
            imported += records.length;
            logger.info(`   Inserted ${imported} typeMaterials rows...`);
            records.length = 0;
          }
        }
      }

      if (records.length > 0) {
        await database.bulkUpsert('typematerials', records, [
          'typeId',
          'materialTypeId',
        ]);
        imported += records.length;
      }

      await this.markTableAsImported('typeMaterials', buildNumber, imported);
      logger.info(`✅ Imported ${imported} typeMaterials rows`);
    } catch (error) {
      logger.error('❌ Error importing typeMaterials:', error);
      throw error;
    }
  }

  /**
   * Import blueprints (activities, materials, products, skills) into Postgres
   */
  async importBlueprints(buildNumber?: number): Promise<void> {
    if (!buildNumber) {
      const metadata = await this.getMetadata();
      if (!metadata) {
        logger.error('❌ No build number available for blueprints');
        return;
      }
      buildNumber = metadata.buildNumber;
    }

    if (!this.forceReimport) {
      const alreadyImported = await this.isTableAlreadyImported(
        'blueprints',
        buildNumber
      );
      if (alreadyImported) {
        logger.info(
          `⏭️  Skipping blueprints (already imported for build ${buildNumber})`
        );
        return;
      }
    }

    logger.info('📥 Importing blueprints...');
    const filepath = this.getTablePath('blueprints');
    if (!existsSync(filepath)) {
      logger.error(`❌ blueprints.jsonl not found at ${filepath}`);
      return;
    }

    const BATCH_SIZE = 1000;
    const blueprintRows: any[] = [];
    const activityRows: any[] = [];
    const materialRows: any[] = [];
    const productRows: any[] = [];
    const skillRows: any[] = [];
    let importedBlueprints = 0;
    const blueprintSeen = new Set<number>();
    const activitySeen = new Set<string>();
    const materialSeen = new Set<string>();
    const productSeen = new Set<string>();
    const skillSeen = new Set<string>();

    const flush = async () => {
      if (blueprintRows.length > 0) {
        await database.bulkUpsert(
          'blueprints',
          blueprintRows,
          'blueprintTypeId'
        );
        importedBlueprints += blueprintRows.length;
        blueprintRows.length = 0;
        logger.info(`   Inserted ${importedBlueprints} blueprint rows...`);
      }
      if (activityRows.length > 0) {
        await database.bulkUpsert('blueprintactivities', activityRows, [
          'blueprintTypeId',
          'activity',
        ]);
        activityRows.length = 0;
      }
      if (materialRows.length > 0) {
        await database.bulkUpsert('blueprintmaterials', materialRows, [
          'blueprintTypeId',
          'activity',
          'materialTypeId',
        ]);
        materialRows.length = 0;
      }
      if (productRows.length > 0) {
        await database.bulkUpsert('blueprintproducts', productRows, [
          'blueprintTypeId',
          'activity',
          'productTypeId',
        ]);
        productRows.length = 0;
      }
      if (skillRows.length > 0) {
        await database.bulkUpsert('blueprintskills', skillRows, [
          'blueprintTypeId',
          'activity',
          'skillTypeId',
        ]);
        skillRows.length = 0;
      }
    };

    try {
      for await (const row of streamParseJSONLines(filepath)) {
        const blueprintTypeId =
          row._key || row.blueprintTypeID || row.blueprintTypeId;
        if (!blueprintTypeId) continue;

        const bpIdNum = Number(blueprintTypeId);
        if (!blueprintSeen.has(bpIdNum)) {
          blueprintSeen.add(bpIdNum);
          blueprintRows.push({
            blueprintTypeId: bpIdNum,
            maxProductionLimit: row.maxProductionLimit
              ? Number(row.maxProductionLimit)
              : null,
          });
        }

        const activities = row.activities || {};
        for (const [activity, activityData] of Object.entries(activities)) {
          const activityKey = `${bpIdNum}|${activity}`;
          if (!activitySeen.has(activityKey)) {
            activitySeen.add(activityKey);
            activityRows.push({
              blueprintTypeId: bpIdNum,
              activity,
              time: activityData?.time ? Number(activityData.time) : null,
            });
          }

          if (Array.isArray(activityData?.materials)) {
            for (const material of activityData.materials) {
              const materialTypeId =
                material.typeID || material.materialTypeID || material.typeId;
              if (!materialTypeId) continue;

              const materialKey = `${bpIdNum}|${activity}|${materialTypeId}`;
              if (materialSeen.has(materialKey)) continue;
              materialSeen.add(materialKey);

              materialRows.push({
                blueprintTypeId: bpIdNum,
                activity,
                materialTypeId: Number(materialTypeId),
                quantity: Number(material.quantity) || 0,
              });
            }
          }

          if (Array.isArray(activityData?.products)) {
            for (const product of activityData.products) {
              const productTypeId =
                product.typeID || product.productTypeID || product.typeId;
              if (!productTypeId) continue;

              const productKey = `${bpIdNum}|${activity}|${productTypeId}`;
              if (productSeen.has(productKey)) continue;
              productSeen.add(productKey);

              productRows.push({
                blueprintTypeId: bpIdNum,
                activity,
                productTypeId: Number(productTypeId),
                quantity: Number(product.quantity) || 0,
                probability:
                  product.probability !== undefined
                    ? Number(product.probability)
                    : null,
              });
            }
          }

          if (Array.isArray(activityData?.skills)) {
            for (const skill of activityData.skills) {
              const skillTypeId =
                skill.typeID || skill.skillTypeID || skill.typeId;
              if (!skillTypeId) continue;

              const skillKey = `${bpIdNum}|${activity}|${skillTypeId}`;
              if (skillSeen.has(skillKey)) continue;
              skillSeen.add(skillKey);

              skillRows.push({
                blueprintTypeId: bpIdNum,
                activity,
                skillTypeId: Number(skillTypeId),
                level: Number(skill.level) || 0,
              });
            }
          }
        }

        if (
          blueprintRows.length >= BATCH_SIZE ||
          activityRows.length >= BATCH_SIZE ||
          materialRows.length >= BATCH_SIZE ||
          productRows.length >= BATCH_SIZE ||
          skillRows.length >= BATCH_SIZE
        ) {
          await flush();
        }
      }

      await flush();

      await this.markTableAsImported(
        'blueprints',
        buildNumber,
        importedBlueprints
      );
      logger.info(`✅ Imported ${importedBlueprints} blueprints`);
    } catch (error) {
      logger.error('❌ Error importing blueprints:', error);
      throw error;
    }
  }

  /**
   * Import typeDogma table (dogma attributes per type)
   * Custom import since each type has an array of attributes
   */
  async importTypeDogma(buildNumber?: number): Promise<void> {
    if (!buildNumber) {
      const metadata = await this.getMetadata();
      if (!metadata) {
        logger.error('❌ No build number available for typeDogma');
        return;
      }
      buildNumber = metadata.buildNumber;
    }

    if (!this.forceReimport) {
      const alreadyImported = await this.isTableAlreadyImported(
        'typeDogma',
        buildNumber
      );
      if (alreadyImported) {
        logger.info(
          `⏭️  Skipping typeDogma (already imported for build ${buildNumber})`
        );
        return;
      }
    }

    logger.info('📥 Importing typeDogma...');
    const filepath = this.getTablePath('typeDogma');
    if (!existsSync(filepath)) {
      logger.error(`❌ typeDogma.jsonl not found at ${filepath}`);
      return;
    }

    const BATCH_SIZE = 5000;
    const rows: any[] = [];
    let importedCount = 0;
    const seen = new Set<string>();

    const flush = async () => {
      if (rows.length > 0) {
        await database.bulkUpsert('typedogma', rows, ['typeId', 'attributeId']);
        importedCount += rows.length;
        rows.length = 0;
        logger.info(`   Inserted ${importedCount} typeDogma rows...`);
      }
    };

    try {
      for await (const row of streamParseJSONLines(filepath)) {
        const typeId = row._key || row.typeID || row.typeId;
        if (!typeId) continue;

        const dogmaAttributes = row.dogmaAttributes;
        if (!Array.isArray(dogmaAttributes)) continue;

        for (const attr of dogmaAttributes) {
          const attributeId = attr.attributeID || attr.attributeId;
          const value = attr.value;

          if (attributeId === undefined || value === undefined) continue;

          const key = `${typeId}:${attributeId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          rows.push({
            typeId: Number(typeId),
            attributeId: Number(attributeId),
            value: Number(value),
          });

          if (rows.length >= BATCH_SIZE) {
            await flush();
          }
        }
      }

      await flush();

      await this.markTableAsImported('typeDogma', buildNumber, importedCount);
      logger.info(`✅ Imported ${importedCount} typeDogma rows`);
    } catch (error) {
      logger.error('❌ Error importing typeDogma:', error);
      throw error;
    }
  }

  /**
   * Import mapSolarSystems table into ClickHouse
   */
  async importMapSolarSystems(buildNumber?: number): Promise<void> {
    // Get buildNumber if not provided
    if (!buildNumber) {
      const metadata = await this.getMetadata();
      if (!metadata) {
        logger.error('❌ No build number available for mapSolarSystems');
        return;
      }
      buildNumber = metadata.buildNumber;
    }

    // Check if already imported (skip if force reimport is enabled)
    if (!this.forceReimport) {
      const alreadyImported = await this.isTableAlreadyImported(
        'mapSolarSystems',
        buildNumber
      );
      if (alreadyImported) {
        logger.info(
          `⏭️  Skipping mapSolarSystems (already imported for build ${buildNumber})`
        );
        return;
      }
    }

    logger.info('📥 Importing mapSolarSystems...');

    const filepath = this.getTablePath('mapSolarSystems');
    if (!existsSync(filepath)) {
      logger.error(`❌ mapSolarSystems.jsonl not found at ${filepath}`);
      return;
    }

    let imported = 0;
    const records: any[] = [];
    const BATCH_SIZE = 1000;

    try {
      for await (const row of streamParseJSONLines(filepath)) {
        const record = {
          solarSystemId: row._key || row.id || null,
          border: toBoolean(row.border),
          constellationId: row.constellationID || null,
          corridor: toBoolean(row.corridor),
          factionId: row.factionID || null,
          fringe: toBoolean(row.fringe),
          hub: toBoolean(row.hub),
          international: toBoolean(row.international),
          luminosity: parseNumber(row.luminosity),
          name: extractLanguageField(row.name, 'en'),
          planetIds:
            row.planetIDs && row.planetIDs.length > 0
              ? row.planetIDs.map((id: any) => Number(id))
              : null,
          positionX: parseNumber(row.position?.x),
          positionY: parseNumber(row.position?.y),
          positionZ: parseNumber(row.position?.z),
          radius: parseNumber(row.radius),
          regional: toBoolean(row.regional),
          regionId: row.regionID || null,
          securityClass: row.securityClass || 'B',
          securityStatus: parseNumber(row.securityStatus),
          stargateIds:
            row.stargateIDs && row.stargateIDs.length > 0
              ? row.stargateIDs.map((id: any) => Number(id))
              : null,
          starId: row.starID || null,
          visualEffect: row.visualEffect || '',
          wormholeClassId: row.wormholeClassID || null,
          updatedAt: new Date(),
        };

        records.push(record);
        imported++;

        // Batch insert
        if (records.length >= BATCH_SIZE) {
          await database.bulkUpsert('solarsystems', records, 'solarSystemId');
          logger.info(`   Inserted ${imported} rows...`);
          records.length = 0;
        }
      }

      // Insert remaining
      if (records.length > 0) {
        await database.bulkUpsert('solarsystems', records, 'solarSystemId');
      }

      // Mark as imported
      await this.markTableAsImported('mapSolarSystems', buildNumber, imported);

      logger.info(`✅ Imported ${imported} solar systems`);
    } catch (error) {
      logger.error('❌ Error importing mapSolarSystems:', error);
      throw error;
    }
  }

  /**
   * Import mapRegions table into ClickHouse
   */
  async importMapRegions(buildNumber?: number): Promise<void> {
    // Get buildNumber if not provided
    if (!buildNumber) {
      const metadata = await this.getMetadata();
      if (!metadata) {
        logger.error('❌ No build number available for mapRegions');
        return;
      }
      buildNumber = metadata.buildNumber;
    }

    // Check if already imported (skip if force reimport is enabled)
    if (!this.forceReimport) {
      const alreadyImported = await this.isTableAlreadyImported(
        'mapRegions',
        buildNumber
      );
      if (alreadyImported) {
        logger.info(
          `⏭️  Skipping mapRegions (already imported for build ${buildNumber})`
        );
        return;
      }
    }

    logger.info('📥 Importing mapRegions...');

    const filepath = this.getTablePath('mapRegions');
    if (!existsSync(filepath)) {
      logger.error(`❌ mapRegions.jsonl not found at ${filepath}`);
      return;
    }

    let imported = 0;
    const records: any[] = [];
    const BATCH_SIZE = 1000;

    try {
      for await (const row of streamParseJSONLines(filepath)) {
        const record = {
          regionId: row._key || row.id || null,
          // constellationIds: (row.constellationIDs && row.constellationIDs.length > 0) ? sql.array(row.constellationIDs.map((id: any) => Number(id))) : null,
          description: extractLanguageField(row.description, 'en'),
          factionId: row.factionID || null,
          name: extractLanguageField(row.name, 'en'),
          nebulaId: row.nebulaID || null,
          positionX: parseNumber(row.position?.x),
          positionY: parseNumber(row.position?.y),
          positionZ: parseNumber(row.position?.z),
          wormholeClassId: row.wormholeClassID || null,
          updatedAt: new Date(),
        };

        records.push(record);
        imported++;

        // Batch insert
        if (records.length >= BATCH_SIZE) {
          await database.bulkUpsert('regions', records, 'regionId');
          logger.info(`   Inserted ${imported} rows...`);
          records.length = 0;
        }
      }

      // Insert remaining
      if (records.length > 0) {
        await database.bulkUpsert('regions', records, 'regionId');
      }

      // Mark as imported
      await this.markTableAsImported('mapRegions', buildNumber, imported);

      logger.info(`✅ Imported ${imported} regions`);
    } catch (error) {
      logger.error('❌ Error importing mapRegions:', error);
      throw error;
    }
  }

  /**
   * Import mapConstellations table into ClickHouse
   */
  async importMapConstellations(buildNumber?: number): Promise<void> {
    // Get buildNumber if not provided
    if (!buildNumber) {
      const metadata = await this.getMetadata();
      if (!metadata) {
        logger.error('❌ No build number available for mapConstellations');
        return;
      }
      buildNumber = metadata.buildNumber;
    }

    // Check if already imported
    if (await this.isTableAlreadyImported('mapConstellations', buildNumber)) {
      logger.info(
        '⏭️  mapConstellations already imported for this build, skipping'
      );
      return;
    }

    logger.info('📥 Importing mapConstellations...');

    const filepath = this.getTablePath('mapConstellations');
    if (!existsSync(filepath)) {
      logger.error(`❌ mapConstellations.jsonl not found at ${filepath}`);
      return;
    }

    let imported = 0;
    const records: any[] = [];
    const BATCH_SIZE = 1000;

    try {
      for await (const row of streamParseJSONLines(filepath)) {
        const record = {
          constellationId: row._key || row.id || null,
          factionId: row.factionID || null,
          name: extractLanguageField(row.name, 'en'),
          positionX: parseNumber(row.position?.x),
          positionY: parseNumber(row.position?.y),
          positionZ: parseNumber(row.position?.z),
          regionId: row.regionID || null,
          solarSystemIds: row.solarSystemIDs || [],
          wormholeClassId: row.wormholeClassID || null,
          updatedAt: new Date(),
        };

        records.push(record);
        imported++;

        // Batch insert
        if (records.length >= BATCH_SIZE) {
          await database.bulkUpsert(
            'constellations',
            records,
            'constellationId'
          );
          logger.info(`   Inserted ${imported} rows...`);
          records.length = 0;
        }
      }

      // Insert remaining
      if (records.length > 0) {
        await database.bulkUpsert('constellations', records, 'constellationId');
      }

      // Mark as imported
      await this.markTableAsImported(
        'mapConstellations',
        buildNumber,
        imported
      );

      logger.info(`✅ Imported ${imported} constellations`);
    } catch (error) {
      logger.error('❌ Error importing mapConstellations:', error);
      throw error;
    }
  }

  /**
   * Post-process map tables to populate missing relationships
   * Must be called after importing regions, constellations, and solarsystems
   */
  async postProcessMapTables(): Promise<void> {
    logger.info('🔧 Post-processing map tables...');

    try {
      // Populate regionId in solarsystems from constellations
      await database.execute(
        `UPDATE solarsystems ss
         SET "regionId" = c."regionId"
         FROM constellations c
         WHERE ss."constellationId" = c."constellationId"
         AND ss."regionId" IS NULL`
      );

      logger.info(`   ✓ Updated regionId in solarsystems`);
    } catch (error) {
      logger.error('⚠️  Error post-processing map tables:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Generic import for any SDE table using field mappings
   * This method replaces manual imports for each table
   */
  async importTable(
    tableName: string,
    fieldMappings: Array<{
      source: string;
      target: string;
      type: 'string' | 'number' | 'boolean' | 'array' | 'json';
      transform?: (value: any) => any;
    }>,
    buildNumber?: number,
    sourceTableName?: string,
    primaryKey?: string
  ): Promise<number> {
    // Get buildNumber if not provided
    if (!buildNumber) {
      const metadata = await this.getMetadata();
      if (!metadata) {
        logger.error(`❌ No build number available for ${tableName}`);
        return 0;
      }
      buildNumber = metadata.buildNumber;
    }

    // Check if already imported (skip if force reimport is enabled)
    if (!this.forceReimport) {
      const alreadyImported = await this.isTableAlreadyImported(
        tableName,
        buildNumber
      );
      if (alreadyImported) {
        logger.info(
          `⏭️  Skipping ${tableName} (already imported for build ${buildNumber})`
        );
        return 0;
      }
    }

    logger.info(`📥 Importing ${tableName}...`);

    const sourceName = sourceTableName ?? tableName;
    const filepath = this.getTablePath(sourceName);
    if (!existsSync(filepath)) {
      logger.error(`❌ ${sourceName}.jsonl not found at ${filepath}`);
      return 0;
    }

    let imported = 0;
    const records: any[] = [];
    const BATCH_SIZE = 1000;

    try {
      for await (const row of streamParseJSONLines(filepath)) {
        const record: any = {};

        for (const mapping of fieldMappings) {
          const value = this.getNestedValue(row, mapping.source);

          if (value === undefined || value === null) {
            record[mapping.target] = null;
          } else {
            record[mapping.target] = mapping.transform
              ? mapping.transform(value)
              : this.convertValue(value, mapping.type);
          }
        }

        records.push(record);
        imported++;

        if (records.length >= BATCH_SIZE) {
          if (primaryKey) {
            await database.bulkUpsert(
              tableName.toLowerCase(),
              records,
              primaryKey
            );
          } else {
            await database.bulkInsert(tableName.toLowerCase(), records);
          }
          logger.info(`   Inserted ${imported} rows...`);
          records.length = 0;
        }
      }

      if (records.length > 0) {
        if (primaryKey) {
          await database.bulkUpsert(
            tableName.toLowerCase(),
            records,
            primaryKey
          );
        } else {
          await database.bulkInsert(tableName.toLowerCase(), records);
        }
      }

      // Mark as imported
      await this.markTableAsImported(tableName, buildNumber, imported);

      logger.info(`✅ Imported ${imported} ${tableName}`);
      return imported;
    } catch (error) {
      logger.error(`❌ Error importing ${tableName}:`, error);
      throw error;
    }
  }

  async importConfiguredTable(
    config: TableConfig,
    buildNumber?: number
  ): Promise<number> {
    return await this.importTable(
      config.name,
      config.mappings,
      buildNumber,
      config.sourceName,
      config.primaryKey
    );
  }

  /**
   * Helper: Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Helper: Convert value to target type
   */
  private convertValue(value: any, type: string): any {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return parseNumber(value);
      case 'boolean':
        return toBoolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value);
      default:
        return value;
    }
  }
}

/**
 * Standalone function to get latest build (convenience wrapper)
 */
export async function getLatestBuild(): Promise<{
  buildNumber: number;
  url: string;
}> {
  const fetcher = new SDEFetcher();
  return await fetcher.getLatestBuild();
}

/**
 * Singleton instance
 */
export const sdeFetcher = new SDEFetcher();
