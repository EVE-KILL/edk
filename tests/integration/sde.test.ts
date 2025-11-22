import { describe, test, expect, mock } from 'bun:test';
import sdeDownloadCommand from '../../commands/sde/download';

describe('SDE Download Command', () => {
  test('should run the full SDE import process', async () => {
    // Create a mock sdeFetcher object
    const mockSdeFetcher = {
      sync: mock(async () => ({
        buildNumber: 123,
        variant: 'test',
        downloadedAt: Date.now(),
        extractedAt: Date.now(),
        url: 'http://test.com/sde.zip',
      })),
      listExtractedTables: mock(async () => [
        'mapRegions',
        'mapSolarSystems',
        'mapConstellations',
      ]),
      importMapSolarSystems: mock(async () => {}),
      importMapRegions: mock(async () => {}),
      importMapConstellations: mock(async () => {}),
      importConfiguredTable: mock(async () => {}),
      optimizeViews: mock(async () => {}),
      cleanup: mock(async () => {}),
      enableForceReimport: mock(() => {}),
      disableForceReimport: mock(() => {}),
    };

    // Run the command's action, injecting the mock fetcher
    await sdeDownloadCommand.action({ force: false }, mockSdeFetcher);

    // Verify the key steps were executed
    expect(mockSdeFetcher.sync).toHaveBeenCalled();
    expect(mockSdeFetcher.importMapSolarSystems).toHaveBeenCalled();
    expect(mockSdeFetcher.importConfiguredTable).toHaveBeenCalled();
    expect(mockSdeFetcher.optimizeViews).toHaveBeenCalled();
    expect(mockSdeFetcher.cleanup).toHaveBeenCalled();
  });
});
