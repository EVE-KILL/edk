import { BaseCommand } from "../../src/commands/base-command";
import { JobDispatcher } from "../../src/queue/job-dispatcher";
import { db } from "../../src/db";
import { killmails } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * EVE-KILL WebSocket Listener Command
 *
 * Connects to EVE-KILL's WebSocket stream for real-time killmails.
 * When a killmail is received:
 * 1. Check if it already exists in database
 * 2. If new, enqueue killmail-fetch job
 * 3. The killmail-fetch worker will fetch complete data and enqueue entity fetches
 *
 * Usage:
 *   bun cli ekws
 *
 * Features:
 * - Real-time killmail stream from EVE-KILL
 * - Automatic ping/pong handling
 * - Graceful reconnection on failure
 * - Statistics tracking
 */
export default class EkwsCommand extends BaseCommand {
  override name = "ekws";
  override description = "Listen to EVE-KILL WebSocket for real-time killmails";
  override usage = "bun cli ekws";

  private readonly WS_URL = "wss://ws.eve-kill.com/killmails";
  private dispatcher: JobDispatcher | null = null;
  private running = false;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private stats = {
    received: 0,
    new: 0,
    duplicate: 0,
    pings: 0,
    errors: 0,
  };
  private followedCharacterIds: number[] = [];
  private followedCorporationIds: number[] = [];
  private followedAllianceIds: number[] = [];
  private filteringEnabled: boolean = false;

  override async execute(args: string[]): Promise<void> {
    // Initialize dispatcher
    this.dispatcher = new JobDispatcher(db);

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

    this.info(`🚀 Starting EVE-KILL WebSocket listener`);
    this.info(`📡 WebSocket URL: ${this.WS_URL}`);
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
    await this.connect();
  }

  /**
   * Connect to WebSocket with automatic reconnection
   */
  private async connect(): Promise<void> {
    while (this.running) {
      try {
        await this.connectWebSocket();
      } catch (error) {
        this.stats.errors++;
        this.error(`❌ WebSocket error: ${error}`);

        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          this.info(
            `🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`
          );
          await this.sleep(this.RECONNECT_DELAY);
        } else {
          this.error("❌ Max reconnection attempts reached. Giving up.");
          this.running = false;
          break;
        }
      }
    }
  }

  /**
   * Establish WebSocket connection and listen for messages
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
          this.success("✅ Connected to EVE-KILL WebSocket");
          this.reconnectAttempts = 0;

          // Send subscription message
          this.ws!.send("all");
          this.info("📡 Subscribed to 'all' killmails");
        };

        this.ws.onmessage = (event) => {
          try {
            this.handleMessage(event.data);
          } catch (error) {
            this.error(`Error handling message: ${error}`);
            this.stats.errors++;
          }
        };

        this.ws.onerror = (event) => {
          this.error(`WebSocket error: ${event}`);
          reject(new Error("WebSocket error"));
        };

        this.ws.onclose = () => {
          this.info("🔌 WebSocket disconnected");
          resolve();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "info":
          this.info(`ℹ️  ${message.message}`);
          if (
            message.data?.validTopics &&
            Array.isArray(message.data.validTopics)
          ) {
            this.info(`   Valid topics: ${message.data.validTopics.join(", ")}`);
          }
          break;

        case "subscribed":
          this.success(`✓ Subscribed to topics: ${message.data?.topics?.join(", ")}`);
          break;

        case "ping":
          this.stats.pings++;
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(`{"type":"pong"}`);
          }
          this.info(
            `📡 Ping/pong (total pings: ${this.stats.pings})`
          );
          break;

        case "killmail":
          this.processKillmail(message.data);
          this.printStats();
          break;

        default:
          this.info(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.error(`Failed to parse message: ${error}`);
      this.error(`Raw data: ${data.substring(0, 200)}...`);
    }
  }

  /**
   * Process a killmail from WebSocket
   */
  private async processKillmail(data: any): Promise<void> {
    const killmail = data?.killmail;

    if (!killmail) {
      this.error(`⚠️  Invalid killmail data (no killmail object)`);
      return;
    }

    const killmailId = killmail.killmail_id;
    const hash = killmail.killmail_hash;

    if (!killmailId || !hash) {
      this.error(
        `⚠️  Invalid killmail (missing ID or hash): ${JSON.stringify(killmail).substring(0, 100)}...`
      );
      return;
    }

    // Filter killmail if filtering is enabled
    if (this.filteringEnabled && !this.isRelevantKillmail(killmail)) {
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

    // New killmail - enqueue fetch job with HIGH priority
    this.stats.received++;
    this.stats.new++;

    await this.dispatcher!.dispatch(
      "killmail-fetch",
      "fetch",
      {
        killmailId,
        hash,
      },
      {
        priority: 0, // Highest priority - process new killmails first
      }
    );

    this.success(
      `✓ Killmail ${killmailId} queued (${killmail.system_name || "Unknown"}, ${killmail.total_value || 0} ISK)`
    );
  }

  /**
   * Check if a killmail involves any followed entities
   */
  private isRelevantKillmail(killmail: any): boolean {
    // Check victim
    const victim = killmail.victim;
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
    const attackers = killmail.attackers || [];
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
    if (this.stats.received % 25 === 0) {
      this.info("");
      this.info(`📊 Stats (every 25 killmails):`);
      this.info(`   Received: ${this.stats.received}`);
      this.info(`   New: ${this.stats.new}`);
      this.info(`   Duplicate: ${this.stats.duplicate}`);
      this.info(`   Pings: ${this.stats.pings}`);
      this.info(`   Errors: ${this.stats.errors}`);
      this.info("");
    }
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    this.info("");
    this.info("🛑 Shutting down EVE-KILL WebSocket listener...");
    this.running = false;

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
    }

    // Print final stats
    this.info("");
    this.info(`📊 Final Stats:`);
    this.info(`   Received: ${this.stats.received}`);
    this.info(`   New: ${this.stats.new}`);
    this.info(`   Duplicate: ${this.stats.duplicate}`);
    this.info(`   Pings: ${this.stats.pings}`);
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
  bun cli ${this.name}

Description:
  Connects to EVE-KILL's real-time WebSocket stream for killmails. When a new
  killmail is received, it's queued for processing. The system will:

  1. Check if killmail already exists in database
  2. If new, enqueue a killmail-fetch job
  3. Worker fetches complete killmail data from EVE-KILL
  4. Worker enqueues ESI fetch jobs for related entities:
     - Characters (victim + attackers)
     - Corporations
     - Alliances

Environment Variables:
  FOLLOWED_CHARACTER_IDS    Comma-separated character IDs to filter by (optional)
  FOLLOWED_CORPORATION_IDS  Comma-separated corporation IDs to filter by (optional)
  FOLLOWED_ALLIANCE_IDS     Comma-separated alliance IDs to filter by (optional)

Examples:
  bun cli ${this.name}
  
  # With filtering
  FOLLOWED_CHARACTER_IDS=12345,67890 bun cli ${this.name}
  FOLLOWED_ALLIANCE_IDS=99009163 bun cli ${this.name}

Features:
  - Real-time killmail stream from EVE-KILL WebSocket
  - Automatic ping/pong handling
  - Graceful reconnection on failure (up to 10 attempts)
  - Optional entity filtering
  - Statistics tracking
`);
  }
}
