import { ApiController } from "../../../../src/controllers/api-controller";
import { allianceService } from "../../../services/esi/alliance-service";

/**
 * Alliance API Controller
 * GET /api/alliances/:id - Get alliance by ID
 */
export class Controller extends ApiController {
  // Cache health endpoint responses for 30 seconds
  static cacheConfig = {
    ttl: 300,
  };

  override async get(): Promise<Response> {
    const allianceIdStr = this.getParam("id");

    if (!allianceIdStr) {
      return this.error("Alliance ID is required", 400);
    }

    const allianceId = parseInt(allianceIdStr);

    if (isNaN(allianceId)) {
      return this.error("Invalid alliance ID", 400);
    }

    try {
      const alliance = await allianceService.getAlliance(allianceId);
      return this.success(alliance);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.error(errorMessage, 500);
    }
  }
}
