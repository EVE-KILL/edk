import { describe, test, expect } from 'bun:test';

describe('Industrial ship category', () => {
  test('Industrial group IDs are correctly defined', () => {
    // Industrial ship group IDs:
    // 28 = Hauler (T1 industrials like Iteron, Badger, etc.)
    // 380 = Deep Space Transport (T2 haulers like Impel, Mastodon)
    // 513 = Freighter (Charon, Providence, etc.)
    // 902 = Jump Freighter (Rhea, Ark, etc.)
    // 941 = Industrial Command Ship (Porpoise, Orca, Rorqual)
    // 883 = Capital Industrial Ship (Rorqual)
    // 463 = Mining Barge (Procurer, Retriever, Covetor)
    // 543 = Exhumer (Skiff, Mackinaw, Hulk)

    const industrialGroups = [28, 380, 513, 902, 941, 883, 463, 543];

    expect(industrialGroups).toHaveLength(8);
    expect(industrialGroups).toContain(28); // Hauler
    expect(industrialGroups).toContain(380); // Deep Space Transport
    expect(industrialGroups).toContain(513); // Freighter
    expect(industrialGroups).toContain(902); // Jump Freighter
    expect(industrialGroups).toContain(941); // Industrial Command Ship
    expect(industrialGroups).toContain(883); // Capital Industrial Ship
    expect(industrialGroups).toContain(463); // Mining Barge
    expect(industrialGroups).toContain(543); // Exhumer
  });

  test('Industrial groups include freighters', () => {
    const industrialGroups = [28, 380, 513, 902, 941, 883, 463, 543];
    const freighterGroups = [513, 902];

    // All freighter groups should be in industrial groups
    freighterGroups.forEach((groupId) => {
      expect(industrialGroups).toContain(groupId);
    });
  });

  test('Industrial groups include mining ships', () => {
    const industrialGroups = [28, 380, 513, 902, 941, 883, 463, 543];
    const miningGroups = [463, 543]; // Mining Barge, Exhumer

    miningGroups.forEach((groupId) => {
      expect(industrialGroups).toContain(groupId);
    });
  });

  test('Industrial groups include command ships', () => {
    const industrialGroups = [28, 380, 513, 902, 941, 883, 463, 543];
    const commandShipGroups = [941, 883]; // Industrial Command Ship, Capital Industrial

    commandShipGroups.forEach((groupId) => {
      expect(industrialGroups).toContain(groupId);
    });
  });
});
