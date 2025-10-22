import { BaseCommand } from "../../src/commands/base-command";
import { JobDispatcher } from "../../src/queue/job-dispatcher";
import { db } from "../../src/db";
import { killmails } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * RedisQ Listener Command
 *
 * Listens to zkillboard's RedisQ service for new killmails.
 * When a killmail is received:
 * 1. Check if it already exists in database
 * 2. If new, enqueue killmail-fetch job
 * 3. The killmail-fetch worker will fetch from ESI and enqueue entity fetches
 *
 * Usage:
 *   bun cli redisq
 *   bun cli redisq --queue-id=my-custom-id
 */
export default class RedisQCommand extends BaseCommand {
  override name = "redisq";
  override description = "Listen to zkillboard RedisQ for new killmails";
  override usage = "bun cli redisq [--queue-id=<id>]";

  private readonly REDISQ_URL = "https://zkillredisq.stream/listen.php";
  private queueId: string = "";
  private dispatcher: JobDispatcher | null = null;
  private running = false;
  private stats = {
    received: 0,
    new: 0,
    duplicate: 0,
    filtered: 0,
    errors: 0,
  };
  private followedCharacterIds: number[] = [];
  private followedCorporationIds: number[] = [];
  private followedAllianceIds: number[] = [];
  private filteringEnabled: boolean = false;

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);

    // Initialize dispatcher
    this.dispatcher = new JobDispatcher(db);

    // Get queue ID from args or env
    this.queueId = (parsedArgs.options["queue-id"] as string) || process.env.REDISQ_ID || "ekv4-default";

    // Parse followed entities from environment
    this.followedCharacterIds = process.env.FOLLOWED_CHARACTER_IDS?.trim()
      ? process.env.FOLLOWED_CHARACTER_IDS.split(",").map((id) =>
          Number.parseInt(id.trim())
        )
      : [];

    this.followedCorporationIds = process.env.FOLLOWED_CORPORATION_IDS?.trim()
      ? process.env.FOLLOWED_CORPORATION_IDS.split(",").map((id) =>
          Number.parseInt(id.trim())
        )
      : [];

    this.followedAllianceIds = process.env.FOLLOWED_ALLIANCE_IDS?.trim()
      ? process.env.FOLLOWED_ALLIANCE_IDS.split(",").map((id) =>
          Number.parseInt(id.trim())
        )
      : [];

    this.filteringEnabled =
      this.followedCharacterIds.length > 0 ||
      this.followedCorporationIds.length > 0 ||
      this.followedAllianceIds.length > 0;

    this.info(`🚀 Starting RedisQ listener`);
    this.info(`📡 Queue ID: ${this.queueId}`);
    this.info(`🔗 Endpoint: ${this.REDISQ_URL}`);
    this.info("");

    if (this.filteringEnabled) {
      this.info("🔍 Filtering enabled for followed entities:");
      if (this.followedCharacterIds.length > 0) {
        this.info(`   Characters: ${this.followedCharacterIds.join(", ")}`);
      }
      if (this.followedCorporationIds.length > 0) {
        this.info(`   Corporations: ${this.followedCorporationIds.join(", ")}`);
      }
      if (this.followedAllianceIds.length > 0) {
        this.info(`   Alliances: ${this.followedAllianceIds.join(", ")}`);
      }
      this.info("");
    } else {
      this.info("📡 No filtering - importing all killmails");
      this.info("");
    }

    this.info("Press Ctrl+C to stop");
    this.info("");

    // Handle graceful shutdown
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());

    this.running = true;
    await this.listen();
  }

  /**
   * Main listening loop
   */
  private async listen(): Promise<void> {
    while (this.running) {
      try {
        await this.pollRedisQ();
      } catch (error) {
        this.stats.errors++;
        this.error(`❌ Error polling RedisQ: ${error}`);
        // Wait a bit before retrying on error
        await this.sleep(5000);
      }
    }
  }

  /**
   * Poll RedisQ for a single killmail
   */
  private async pollRedisQ(): Promise<void> {
    const url = `${this.REDISQ_URL}?queueID=${this.queueId}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { package?: any };

      // RedisQ returns {"package": null} when queue is empty
      if (!data.package) {
        // No killmail available, wait a bit
        await this.sleep(2000);
        return;
      }

      this.stats.received++;
      await this.processKillmail(data.package);
      await this.sleep(2000);
      this.printStats();
    } catch (error) {
      // Log more detailed error information
      if (error instanceof Error) {
        throw new Error(`Failed to poll RedisQ: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Process a killmail from RedisQ
   */
  private async processKillmail(pkg: any): Promise<void> {
    const killmailId = pkg.killID;
    const hash = pkg.zkb?.hash;

    if (!killmailId || !hash) {
      this.error(`⚠️  Invalid killmail package (missing ID or hash)`);
      return;
    }

    // Filter killmail if filtering is enabled
    if (this.filteringEnabled && !this.isRelevantKillmail(pkg)) {
      this.stats.filtered++;
      return;
    }

    // Check if killmail already exists
    const existing = await db
      .select({ killmailId: killmails.killmailId })
      .from(killmails)
      .where(eq(killmails.killmailId, killmailId))
      .get();

    if (existing) {
      this.stats.duplicate++;
      return;
    }

    // New killmail - enqueue fetch job
    this.stats.new++;
    await this.dispatcher!.dispatch("killmail-fetch", "fetch", {
      killmailId,
      hash,
    });

    this.success(`✓ Killmail ${killmailId} queued for processing`);
  }

  /**
   * Check if a killmail involves any followed entities
   */
  private isRelevantKillmail(pkg: any): boolean {
    // Check victim
    const victim = pkg.killmail?.victim;
    if (victim) {
      if (
        this.followedCharacterIds.includes(victim.character_id) ||
        this.followedCorporationIds.includes(victim.corporation_id) ||
        (victim.alliance_id &&
          this.followedAllianceIds.includes(victim.alliance_id))
      ) {
        return true;
      }
    }

    // Check attackers
    const attackers = pkg.killmail?.attackers || [];
    for (const attacker of attackers) {
      if (
        this.followedCharacterIds.includes(attacker.character_id) ||
        this.followedCorporationIds.includes(attacker.corporation_id) ||
        (attacker.alliance_id &&
          this.followedAllianceIds.includes(attacker.alliance_id))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Print statistics
   */
  private printStats(): void {
    if (this.stats.received % 10 === 0) {
      this.info("");
      this.info(`📊 Stats:`);
      this.info(`   Received: ${this.stats.received}`);
      this.info(`   New: ${this.stats.new}`);
      this.info(`   Duplicate: ${this.stats.duplicate}`);
      if (this.filteringEnabled) {
        this.info(`   Filtered: ${this.stats.filtered}`);
      }
      this.info(`   Errors: ${this.stats.errors}`);
      this.info("");
    }
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    this.info("");
    this.info("🛑 Shutting down RedisQ listener...");
    this.running = false;

    // Print final stats
    this.info("");
    this.info(`📊 Final Stats:`);
    this.info(`   Received: ${this.stats.received}`);
    this.info(`   New: ${this.stats.new}`);
    this.info(`   Duplicate: ${this.stats.duplicate}`);
    if (this.filteringEnabled) {
      this.info(`   Filtered: ${this.stats.filtered}`);
    }
    this.info(`   Errors: ${this.stats.errors}`);

    process.exit(0);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name} [options]

Options:
  --queue-id=<id>    Queue ID for RedisQ (default: env.REDISQ_ID or "ekv4-default")
  --help             Show this help message

Description:
  Listens to zkillboard's RedisQ service for new killmails. When a new killmail
  is received, it's queued for processing. The system will:

  1. Check if killmail already exists in database
  2. If new, enqueue a killmail-fetch job
  3. Worker fetches killmail from ESI
  4. Worker enqueues ESI fetch jobs for all related entities:
     - Characters (victim + attackers)
     - Corporations
     - Alliances
     - Solar systems
     - Types (ships, weapons, items)

Examples:
  bun cli ${this.name}
  bun cli ${this.name} --queue-id=my-custom-queue
`);
  }
}
