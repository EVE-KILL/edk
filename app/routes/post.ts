import { WebController } from "../../src/controllers/web-controller";
import { JobDispatcher } from "../../src/queue/job-dispatcher";
import { killmails } from "../../db/schema";
import { eq } from "drizzle-orm";

export class Controller extends WebController {
  static override methods = ["GET", "POST"];

  // Cache GET requests (form display) for 5 minutes
  static cacheConfig = {
    ttl: 300,
    staleWhileRevalidate: 600,
    skipIf: (req: Request) => req.method !== "GET",
  };

  override async handle(): Promise<Response> {
    const method = this.request.method;

    if (method === "GET") {
      return this.get();
    } else if (method === "POST") {
      return this.post();
    }

    return this.jsonResponse({ error: "Method not allowed" }, 405);
  }

  override async get(): Promise<Response> {
    const data = {};

    return await this.renderPage(
      "pages/post",
      "Post Killmail - EDK",
      "Post a killmail from ESI to EDK",
      data
    );
  }

  override async post(): Promise<Response> {
    try {
      // Parse JSON body
      const body = await this.request.json() as { data: string };
      const input = body.data?.trim();

      if (!input) {
        return this.jsonResponse({
          success: false,
          error: "No data provided",
        }, 400);
      }

      // Parse the input - could be ESI URL or JSON
      const { killmailId, hash } = this.parseInput(input);

      if (!killmailId || !hash) {
        return this.jsonResponse({
          success: false,
          error: "Invalid ESI killmail URL. Please provide a valid URL in the format: https://esi.evetech.net/latest/killmails/{id}/{hash}/",
        }, 400);
      }

      // Check if killmail already exists
      const existing = await this.db
        .select({ killmailId: killmails.killmailId })
        .from(killmails)
        .where(eq(killmails.killmailId, killmailId))
        .get();

      if (existing) {
        // Killmail already exists, redirect to it
        return this.jsonResponse({
          success: true,
          url: `/killmail/${killmailId}`,
          message: "Killmail already exists",
        });
      }

      // New killmail - enqueue fetch job
      const dispatcher = new JobDispatcher(this.queueDb);
      await dispatcher.dispatch("killmail-fetch", "fetch", {
        killmailId,
        hash,
      }, {
        priority: 1,
        maxAttempts: 3,
        skipIfExists: true,
      });

      // Wait for the killmail to be processed (with timeout)
      const killmailUrl = await this.waitForKillmail(killmailId, 30000); // 30 second timeout

      if (killmailUrl) {
        return this.jsonResponse({
          success: true,
          url: killmailUrl,
          message: "Killmail posted successfully",
        });
      } else {
        return this.jsonResponse({
          success: false,
          error: "Killmail processing timed out. Please check back in a moment.",
        }, 408);
      }
    } catch (error) {
      console.error("Post killmail error:", error);
      return this.jsonResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to post killmail",
      }, 500);
    }
  }

  /**
   * Parse input to extract killmailId and hash
   * Only accepts ESI killmail URLs in the format:
   * https://esi.evetech.net/latest/killmails/{id}/{hash}/
   */
  private parseInput(input: string): { killmailId: number | null; hash: string | null } {
    // Strict ESI URL validation
    const esiUrlPattern = /^https:\/\/esi\.evetech\.net\/(?:latest|v1)\/killmails\/(\d+)\/([a-f0-9]{40})\/?$/i;
    const match = input.match(esiUrlPattern);

    if (match) {
      const killmailId = parseInt(match[1]);
      const hash = match[2].toLowerCase();

      // Additional validation
      if (killmailId > 0 && hash.length === 40) {
        return {
          killmailId,
          hash,
        };
      }
    }

    return { killmailId: null, hash: null };
  }

  /**
   * Wait for killmail to be processed and saved to database
   * Polls the database until killmail appears or timeout is reached
   */
  private async waitForKillmail(killmailId: number, timeoutMs: number): Promise<string | null> {
    const startTime = Date.now();
    const pollInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeoutMs) {
      const killmail = await this.db
        .select({ killmailId: killmails.killmailId })
        .from(killmails)
        .where(eq(killmails.killmailId, killmailId))
        .get();

      if (killmail) {
        return `/killmail/${killmailId}`;
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return null;
  }
}
