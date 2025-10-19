import { Killmails } from "../models/killmail";

console.log("🌱 Seeding database...");

// Create sample killmails
const sampleKillmails = [
  {
    killmailId: 100001,
    hash: "sample-hash-1",
    killmailTime: new Date("2025-10-15T14:30:00Z"),
    solarSystemId: 30000142, // Jita
    victim: {
      characterId: 12345,
      corporationId: 98765,
      shipTypeId: 587, // Rifter
      damageTaken: 15000,
    },
    attackers: [
      {
        characterId: 54321,
        corporationId: 11111,
        shipTypeId: 597, // Punisher
        weaponTypeId: 2488,
        damageDone: 15000,
        finalBlow: true,
      },
    ],
    items: [],
    totalValue: 5000000,
    attackerCount: 1,
    isSolo: true,
    isNpc: false,
  },
  {
    killmailId: 100002,
    hash: "sample-hash-2",
    killmailTime: new Date("2025-10-15T15:45:00Z"),
    solarSystemId: 30002187, // Rancer
    victim: {
      characterId: 67890,
      corporationId: 22222,
      shipTypeId: 648, // Stabber
      damageTaken: 45000,
    },
    attackers: [
      {
        characterId: 11111,
        corporationId: 33333,
        allianceId: 44444,
        shipTypeId: 637, // Rupture
        weaponTypeId: 2488,
        damageDone: 25000,
        finalBlow: true,
      },
      {
        characterId: 22222,
        corporationId: 33333,
        allianceId: 44444,
        shipTypeId: 623, // Vexor
        weaponTypeId: 3008,
        damageDone: 20000,
        finalBlow: false,
      },
    ],
    items: [],
    totalValue: 35000000,
    attackerCount: 2,
    isSolo: false,
    isNpc: false,
  },
  {
    killmailId: 100003,
    hash: "sample-hash-3",
    killmailTime: new Date("2025-10-15T16:20:00Z"),
    solarSystemId: 30002187,
    victim: {
      characterId: 99999,
      corporationId: 55555,
      allianceId: 66666,
      shipTypeId: 24698, // Interceptor
      damageTaken: 12000,
    },
    attackers: [
      {
        characterId: 88888,
        corporationId: 77777,
        shipTypeId: 11176, // Sabre
        weaponTypeId: 23057,
        damageDone: 12000,
        finalBlow: true,
      },
    ],
    items: [],
    totalValue: 75000000,
    attackerCount: 1,
    isSolo: true,
    isNpc: false,
  },
];

try {
  const result = await Killmails.bulkInsert(sampleKillmails);
  console.log(`✅ Inserted ${result.length} sample killmails`);

  // Show stats
  const stats = await Killmails.getStats();
  console.log("\n📊 Database Stats:");
  console.log(`Total killmails: ${stats.total}`);
  console.log(`Total value: ${(stats.totalValue / 1000000).toFixed(2)}M ISK`);
  console.log(`Solo kills: ${stats.soloKills}`);
  console.log(`Average value: ${(stats.avgValue / 1000000).toFixed(2)}M ISK`);
  console.log(`Average attackers: ${stats.avgAttackers}`);
} catch (error) {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
}
