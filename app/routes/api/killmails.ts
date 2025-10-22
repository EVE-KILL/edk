import { ApiController } from "../../../src/controllers/api-controller";

/**
 * Killmails API endpoint
 * GET /api/killmails - List recent killmails
 */
export class Controller extends ApiController {
  // Cache killmails list for 30 seconds + 1 minute stale
  static cacheConfig = {
    ttl: 30,
    staleWhileRevalidate: 60,
    vary: ["query"],
  };

  override async get(): Promise<Response> {
    // Get pagination parameters
    const page = parseInt(this.getQuery("page") || "1", 10);
    const perPage = Math.min(parseInt(this.getQuery("perPage") || "50", 10), 100);

    // Use the model to paginate killmails
    const result = await this.models.Killmails.paginate({
      page,
      perPage,
    });

    return this.json({
      data: result.data,
      pagination: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }
}
