import { ApiController } from "../../../../../src/controllers/api-controller";
import { generateKilllist } from "../../../../generators/killlist";
import { generateCharacterDetail } from "../../../../generators/character";

/**
 * GET /api/characters/:id/kills
 *
 * Returns character kills with pagination
 *
 * Query parameters:
 * - limit: Number of killmails to return (default: 20, max: 100)
 * - page: Page number (default: 1)
 */
export class Controller extends ApiController {
  static cacheConfig = {
    ttl: 60,
    vary: ["id", "limit", "page"],
  };

  override async handle(): Promise<Response> {
    const characterIdStr = this.getParam("id");

    if (!characterIdStr) {
      return this.error("Character ID is required", 400);
    }

    const characterId = parseInt(characterIdStr, 10);
    if (isNaN(characterId)) {
      return this.error("Invalid character ID", 400);
    }

    try {
      // Get query parameters
      const url = new URL(this.request.url);
      const limitParam = url.searchParams.get("limit");
      const pageParam = url.searchParams.get("page");

      // Parse and validate limit
      let limit = 20;
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
          limit = parsedLimit;
        }
      }

      // Parse page number
      let currentPage = 1;
      if (pageParam) {
        const parsedPage = parseInt(pageParam, 10);
        if (!isNaN(parsedPage) && parsedPage > 0) {
          currentPage = parsedPage;
        }
      }

      const offset = (currentPage - 1) * limit;

      // Fetch character details for stats
      const characterDetail = await generateCharacterDetail(characterId);
      if (!characterDetail) {
        return this.error("Character not found", 404);
      }

      // Fetch kills with limit+1 to detect if there are more
      const killmails = await generateKilllist(limit + 1, {
        characterIds: [characterId],
        killsOnly: true,
        offset,
      });

      // Check if there are more results
      const hasMore = killmails.length > limit;
      if (hasMore) {
        killmails.pop();
      }

      return this.json({
        character: characterDetail.character,
        stats: characterDetail.stats,
        data: killmails,
        pagination: {
          limit,
          page: currentPage,
          count: killmails.length,
          hasMore,
          nextPage: hasMore ? currentPage + 1 : null,
        },
      });
    } catch (error) {
      console.error(`Error fetching kills for character ${characterId}:`, error);
      return this.error("Failed to fetch character kills", 500);
    }
  }
}
