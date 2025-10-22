import { ApiController } from "../../../../src/controllers/api-controller";
import { corporationService } from "../../../services/esi/corporation-service";

/**
 * Corporation API Controller
 * GET /api/corporations/:id - Get corporation by ID
 */
export class Controller extends ApiController {
  // Cache corporation API responses
  static cacheConfig = {
    ttl: 120,                    // Fresh for 2 minutes
    staleWhileRevalidate: 300,   // Serve stale for 5 more minutes while refreshing
  };

  override async get(): Promise<Response> {
    const corporationIdStr = this.getParam("id");

    if (!corporationIdStr) {
      return this.error("Corporation ID is required", 400);
    }

    const corporationId = parseInt(corporationIdStr);

    if (isNaN(corporationId)) {
      return this.error("Invalid corporation ID", 400);
    }

    try {
      const corporation = await corporationService.getCorporation(corporationId);
      return this.success(corporation);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.error(errorMessage, 500);
    }
  }
}
