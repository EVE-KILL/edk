import { describe, test, expect, mock } from 'bun:test';
import { Job } from 'bullmq';
import esiKillmail from '../fixtures/esi-killmail.json';

const mockFetchESI = mock().mockResolvedValue({ ok: true, data: esiKillmail });
const mockFetchAndStoreCharacter = mock().mockResolvedValue(undefined);
const mockFetchAndStoreCorporation = mock().mockResolvedValue(undefined);
const mockFetchAndStoreAlliance = mock().mockResolvedValue(undefined);
const mockFetchPrices = mock().mockResolvedValue([]);
const mockStorePrices = mock().mockResolvedValue(undefined);
const mockStoreKillmail = mock().mockResolvedValue(undefined);

mock.module('../../server/helpers/esi', () => ({
  fetchESI: mockFetchESI,
}));
mock.module('../../server/fetchers/character', () => ({
  fetchAndStoreCharacter: mockFetchAndStoreCharacter,
}));
mock.module('../../server/fetchers/corporation', () => ({
  fetchAndStoreCorporation: mockFetchAndStoreCorporation,
}));
mock.module('../../server/fetchers/alliance', () => ({
  fetchAndStoreAlliance: mockFetchAndStoreAlliance,
}));
mock.module('../../server/fetchers/price', () => ({
  fetchPrices: mockFetchPrices,
}));
mock.module('../../server/models/prices', () => ({
  storePrices: mockStorePrices,
}));
mock.module('../../server/models/killmails', () => ({
  storeKillmail: mockStoreKillmail,
}));

describe('Queue Processors', () => {
  describe('killmail', () => {
    test('should process a killmail job successfully', async () => {
      const { processor: killmailProcessor } = await import('../../queue/killmail');

      // Create a mock job
      const job = { data: { killmailId: 123456789, hash: 'test_hash' } } as Job;

      // Process the job
      await killmailProcessor(job);

      // Assert that all dependencies were called correctly
      expect(mockFetchESI).toHaveBeenCalledWith(
        '/killmails/123456789/test_hash/'
      );
      expect(mockFetchAndStoreCharacter).toHaveBeenCalledWith(
        93260215
      );
      expect(mockFetchAndStoreCharacter).toHaveBeenCalledWith(
        95465495
      );
      expect(mockFetchAndStoreCorporation).toHaveBeenCalledWith(
        1000001
      );
      expect(mockFetchAndStoreCorporation).toHaveBeenCalledWith(
        1000002
      );
      expect(mockFetchAndStoreAlliance).toHaveBeenCalledWith(
        498125261
      );
      expect(mockFetchPrices).toHaveBeenCalled();
      expect(mockStorePrices).not.toHaveBeenCalled();
      expect(mockStoreKillmail).toHaveBeenCalledWith(
        esiKillmail,
        'test_hash'
      );
    });
  });
});
