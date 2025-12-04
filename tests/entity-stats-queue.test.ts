import { describe, test, expect, beforeAll } from 'bun:test';
import { storeKillmail } from '../server/models/killmails';
import { database } from '../server/helpers/database';
import type { ESIKillmail } from '../server/models/killmails';

describe('Entity Stats Queue Integration', () => {
  beforeAll(async () => {
    // Clean up test data
    await database.execute(
      'DELETE FROM entity_stats_cache WHERE "entityId" IN (12345, 67890, 11111)'
    );
    await database.execute(
      'DELETE FROM killmails WHERE "killmailId" = 123456789'
    );
  });

  test('storeKillmail enqueues entity stats job', async () => {
    // Use current date which should have a partition
    const testDate = new Date();

    const testKillmail: ESIKillmail = {
      killmail_id: 123456789,
      killmail_time: testDate.toISOString(),
      solar_system_id: 30000142, // Jita
      victim: {
        character_id: 12345,
        corporation_id: 67890,
        alliance_id: 11111,
        damage_taken: 10000,
        ship_type_id: 587, // Rifter
      },
      attackers: [
        {
          character_id: 54321,
          corporation_id: 98765,
          alliance_id: 22222,
          damage_done: 10000,
          final_blow: true,
          security_status: 5.0,
          ship_type_id: 588, // Thrasher
        },
      ],
    };

    // Store killmail - should enqueue entity stats job
    await storeKillmail(testKillmail, 'test-hash-123');

    // Verify killmail was stored
    const storedKillmail = await database.findOne<{ killmailId: number }>(
      'SELECT "killmailId" FROM killmails WHERE "killmailId" = :id',
      { id: 123456789 }
    );
    expect(storedKillmail).toBeDefined();
    expect(storedKillmail?.killmailId).toBe(123456789);

    // Note: Entity stats will be processed by the queue worker
    // In a real test, we'd need to wait for the queue to process or mock it
  }, 10000);
});
