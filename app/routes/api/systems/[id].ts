import { ApiController } from "../../../../src/controllers/api-controller";
import { SolarSystemService } from "../../../services/esi/solar-system-service";

export class Controller extends ApiController {
  // ESI solar system data rarely changes - cache for 24 hours
  static cacheConfig = {
    ttl: 86400,
    staleWhileRevalidate: 86400,
    vary: ["id"],
  };

  override async get() {
    const { id } = this.params;
    const systemId = Number.parseInt(id);

    if (Number.isNaN(systemId)) {
      return this.error("Invalid system ID", 400);
    }

    const systemService = new SolarSystemService();

    try {
      const system = await systemService.getSolarSystem(systemId);

      if (!system) {
        return this.error("Solar system not found", 404);
      }

      return this.success(system);
    } catch (error) {
      console.error(`Error fetching system ${systemId}:`, error);
      return this.error("Failed to fetch solar system", 500);
    }
  }
}
