import { ApiController } from "../../../../src/controllers/api-controller";
import { solarSystems } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export class Controller extends ApiController {
  // Solar system data is static - cache for 7 days
  static cacheConfig = {
    ttl: 604800,
    staleWhileRevalidate: 604800,
    vary: ["id"],
  };

  override async get() {
    const { id } = this.params;

    if (!id) {
      return this.error("System ID required", 400);
    }

    const systemId = Number.parseInt(id);

    if (Number.isNaN(systemId)) {
      return this.error("Invalid system ID", 400);
    }

    try {
      const system = await this.db
        .select()
        .from(solarSystems)
        .where(eq(solarSystems.systemId, systemId))
        .get();

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
