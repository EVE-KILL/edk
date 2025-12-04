import { describe, test, expect, mock } from 'bun:test';
import sdeDownloadCommand from '../../commands/sde/download';

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
  postProcessMapTables: mock(async () => {}),
  importTypeMaterials: mock(async () => {}),
  importBlueprints: mock(async () => {}),
  importTypeDogma: mock(async () => {}),
  importConfiguredTable: mock(async () => {}),
  optimizeViews: mock(async () => {}),
  cleanup: mock(async () => {}),
  enableForceReimport: mock(() => {}),
  disableForceReimport: mock(() => {}),
};

mock.module('../../server/helpers/sde/fetcher', () => ({
  sdeFetcher: mockSdeFetcher,
}));

describe('SDE Download Command', () => {
  test('should run the full SDE import process', async () => {
    // Run the command's action (module mocks injected)
    await sdeDownloadCommand.action({ force: false });

    // Verify the key steps were executed
    expect(mockSdeFetcher.sync).toHaveBeenCalled();
    expect(mockSdeFetcher.importMapSolarSystems).toHaveBeenCalled();
    expect(mockSdeFetcher.importConfiguredTable).toHaveBeenCalled();
    expect(mockSdeFetcher.optimizeViews).toHaveBeenCalled();
    expect(mockSdeFetcher.cleanup).toHaveBeenCalled();
  });
});
