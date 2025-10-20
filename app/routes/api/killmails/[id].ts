import { ApiController } from "../../../../src/controllers/api-controller";
import { db } from "../../../../src/db";
import { killmails } from "../../../../db/schema";
import { generateKillmailDetail } from "../../../generators/killmail";
import { eq } from "drizzle-orm";

/**
 * Killmail API Controller
 * GET /api/killmails/:id - Get killmail detail by ID with prices
 */
export class Controller extends ApiController {
  // Cache killmail API responses for 1 hour
  static cacheConfig = {
    ttl: 3600,
  };

  override async get(): Promise<Response> {
    const killmailIdStr = this.getParam("id");

    if (!killmailIdStr) {
      return this.error("Killmail ID is required", 400);
    }

    const killmailId = parseInt(killmailIdStr);

    if (isNaN(killmailId)) {
      return this.error("Invalid killmail ID", 400);
    }

    try {
      // Look up killmail in database
      const [killmail] = await db
        .select()
        .from(killmails)
        .where(eq(killmails.killmailId, killmailId))
        .limit(1);

      if (!killmail) {
        return this.error(`Killmail ${killmailId} not found`, 404);
      }

      // Fetch the detailed killmail with prices
      const killmailDetail = await generateKillmailDetail(killmail.id);

      if (!killmailDetail) {
        return this.error(`Failed to generate killmail detail`, 500);
      }

      return this.success(killmailDetail);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.error(errorMessage, 500);
    }
  }
}
