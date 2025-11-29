import { logger } from '../../server/helpers/logger';
import { database } from '../../server/helpers/database';
import { calculateKillmailValues } from '../../server/models/killmails';

interface KillmailBatch {
  killmailId: number;
  killmailTime: string;
  solarSystemId: number;
  victimShipTypeId: number;
  victimCharacterId: number | null;
  victimCorporationId: number;
}

async function recalculateValues() {
  logger.info('Starting killmail value recalculation');
  logger.info('This will recalculate ALL killmail values with:');
  logger.info('  - Correct region prices (The Forge / region 10000002)');
  logger.info('  - Blueprint Copies (singleton=2) at 1/100th market value');
  logger.info('  - Ship value included in total');

  const startTime = Date.now();
  const BATCH_SIZE = 1000;

  // Get total count
  const countResult = await database.sql`
    SELECT COUNT(*) as count FROM killmails WHERE "totalValue" > 0
  `;
  const totalCount = Number(countResult[0].count);
  logger.info(`Found ${totalCount} killmails to recalculate`);

  let processedCount = 0;
  let updatedCount = 0;
  let lastKillmailId = 0;

  while (processedCount < totalCount) {
    // Fetch a batch of killmails
    const batch = await database.sql<KillmailBatch[]>`
      SELECT
        "killmailId",
        "killmailTime",
        "solarSystemId",
        "victimShipTypeId",
        "victimCharacterId",
        "victimCorporationId"
      FROM killmails
      WHERE "totalValue" > 0
        AND "killmailId" > ${lastKillmailId}
      ORDER BY "killmailId" ASC
      LIMIT ${BATCH_SIZE}
    `;

    if (batch.length === 0) break;

    // Process each killmail in the batch
    const updates: Array<{ killmailId: number; totalValue: number }> = [];

    for (const km of batch) {
      try {
        // Reconstruct ESI format for value calculation
        const esiFormat = {
          killmail_id: km.killmailId,
          killmail_time: km.killmailTime,
          solar_system_id: km.solarSystemId,
          victim: {
            character_id: km.victimCharacterId,
            corporation_id: km.victimCorporationId,
            ship_type_id: km.victimShipTypeId,
            damage_taken: 0,
            items: [],
          },
          attackers: [],
        };

        // Fetch items for this killmail
        const items = await database.sql`
          SELECT
            "itemTypeId",
            "quantityDropped",
            "quantityDestroyed",
            singleton,
            flag
          FROM items
          WHERE "killmailId" = ${km.killmailId}
            AND "killmailTime" = ${km.killmailTime}
        `;

        // Map items to ESI format
        esiFormat.victim.items = items.map((item: any) => ({
          item_type_id: item.itemTypeId,
          quantity_dropped: item.quantityDropped || 0,
          quantity_destroyed: item.quantityDestroyed || 0,
          singleton: item.singleton,
          flag: item.flag,
        }));

        // Calculate new value
        const valueBreakdown = await calculateKillmailValues(esiFormat);

        updates.push({
          killmailId: km.killmailId,
          totalValue: valueBreakdown.totalValue,
        });
      } catch (error) {
        logger.warn(`Failed to recalculate killmail ${km.killmailId}`, {
          error: String(error),
        });
      }

      lastKillmailId = km.killmailId;
    }

    // Bulk update the values
    if (updates.length > 0) {
      for (const update of updates) {
        await database.sql`
          UPDATE killmails
          SET "totalValue" = ${update.totalValue}
          WHERE "killmailId" = ${update.killmailId}
        `;
      }
      updatedCount += updates.length;
    }

    processedCount += batch.length;

    // Progress update every batch
    const progress = ((processedCount / totalCount) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = Math.round(processedCount / Number(elapsed));
    const eta = Math.round((totalCount - processedCount) / rate);

    logger.info(
      `Progress: ${processedCount}/${totalCount} (${progress}%) | ` +
        `Rate: ${rate}/s | ETA: ${eta}s`
    );
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  logger.success('Recalculation complete!', {
    processed: processedCount,
    updated: updatedCount,
    duration: `${duration}s`,
    avgRate: `${Math.round(processedCount / Number(duration))}/s`,
  });
}

async function action() {
  try {
    await recalculateValues();
  } catch (error) {
    logger.error('Recalculation failed:', { error: String(error) });
    process.exit(1);
  } finally {
    await database.close();
    process.exit(0);
  }
}

export default () => ({
  description:
    'Recalculate killmail values using correct region prices (The Forge)',
  action,
});
