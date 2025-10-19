#!/usr/bin/env bun
/**
 * Test script for queue system
 *
 * Enqueues sample jobs and watches them get processed
 */
import { queue } from "./app/queue";

async function testQueue() {
  console.log("🧪 Testing queue system...\n");

  // Test 1: Dispatch a single killmail job
  console.log("1️⃣  Dispatching single killmail job...");
  await queue.dispatch("killmails", "process", {
    killmailId: 100004,
    hash: "test-hash-1",
    data: {
      killmail_time: new Date().toISOString(),
      solar_system_id: 30000142,
      victim: {
        character_id: 12345,
        ship_type_id: 587,
      },
      attackers: [
        {
          character_id: 67890,
          ship_type_id: 671,
        },
      ],
      zkb: {
        totalValue: 50000000,
        points: 1,
      },
    },
  });
  console.log("  ✅ Job enqueued\n");

  // Test 2: Dispatch multiple ESI jobs
  console.log("2️⃣  Dispatching batch ESI jobs...");
  await queue.dispatchMany(
    "esi",
    "fetch",
    [
      { type: "character", id: 12345 },
      { type: "character", id: 67890 },
      { type: "corporation", id: 98000001 },
      { type: "alliance", id: 99000001 },
    ]
  );
  console.log("  ✅ 4 jobs enqueued\n");

  // Test 3: Dispatch delayed job
  console.log("3️⃣  Dispatching delayed job (5 seconds)...");
  await queue.dispatch(
    "killmails",
    "process",
    {
      killmailId: 100005,
      hash: "test-hash-2",
      data: {
        killmail_time: new Date().toISOString(),
        solar_system_id: 30002187,
        victim: { character_id: 11111 },
        attackers: [{ character_id: 22222 }],
        zkb: { totalValue: 1000000 },
      },
    },
    { delay: 5 }
  );
  console.log("  ✅ Delayed job enqueued\n");

  // Test 4: Dispatch high priority job
  console.log("4️⃣  Dispatching high priority job...");
  await queue.dispatch(
    "esi",
    "fetch",
    { type: "character", id: 99999 },
    { priority: -10 }
  );
  console.log("  ✅ High priority job enqueued\n");

  // Show stats
  console.log("📊 Queue statistics:");
  const stats = await queue.getStatsByQueue();
  console.log(JSON.stringify(stats, null, 2));
  console.log();

  const total = await queue.count();
  console.log(`📈 Total jobs in database: ${total}\n`);

  console.log("✅ Test complete!");
  console.log("💡 Tip: Start the server to watch jobs get processed");
  console.log("   bun run index.ts");
}

testQueue().catch(console.error);
