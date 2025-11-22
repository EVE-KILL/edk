import { describe, test, expect, mock } from 'bun:test'
import { Job } from 'bullmq'
import { processor as killmailProcessor } from '../../queue/killmail'
import esiKillmail from '../fixtures/esi-killmail.json'

describe('Queue Processors', () => {
  describe('killmail', () => {
    test('should process a killmail job successfully', async () => {
      // Create mock functions for all dependencies
      const mockDependencies = {
        fetchESI: mock().mockResolvedValue({ ok: true, data: esiKillmail }),
        fetchAndStoreCharacter: mock().mockResolvedValue(undefined),
        fetchAndStoreCorporation: mock().mockResolvedValue(undefined),
        fetchAndStoreAlliance: mock().mockResolvedValue(undefined),
        fetchPrices: mock().mockResolvedValue([]),
        storePrices: mock().mockResolvedValue(undefined),
        storeKillmail: mock().mockResolvedValue(undefined)
      }

      // Create a mock job
      const job = { data: { killmailId: 123456789, hash: 'test_hash' } } as Job

      // Process the job, injecting the mock dependencies
      await killmailProcessor(job, mockDependencies)

      // Assert that all dependencies were called correctly
      expect(mockDependencies.fetchESI).toHaveBeenCalledWith('/killmails/123456789/test_hash/')
      expect(mockDependencies.fetchAndStoreCharacter).toHaveBeenCalledWith(93260215)
      expect(mockDependencies.fetchAndStoreCharacter).toHaveBeenCalledWith(95465495)
      expect(mockDependencies.fetchAndStoreCorporation).toHaveBeenCalledWith(1000001)
      expect(mockDependencies.fetchAndStoreCorporation).toHaveBeenCalledWith(1000002)
      expect(mockDependencies.fetchAndStoreAlliance).toHaveBeenCalledWith(498125261)
      expect(mockDependencies.fetchPrices).toHaveBeenCalled()
      expect(mockDependencies.storePrices).not.toHaveBeenCalled()
      expect(mockDependencies.storeKillmail).toHaveBeenCalledWith(esiKillmail, 'test_hash')
    })
  })
})
