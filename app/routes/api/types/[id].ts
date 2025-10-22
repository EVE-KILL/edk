import { ApiController } from "../../../../src/controllers/api-controller";
import { TypeService } from "../../../services/esi/type-service";

export class Controller extends ApiController {
  // ESI type data rarely changes - cache for 24 hours
  static cacheConfig = {
    ttl: 86400,
    staleWhileRevalidate: 86400,
    vary: ["id"],
  };

  override async get() {
    const { id } = this.params;
    const typeId = Number.parseInt(id);

    if (Number.isNaN(typeId)) {
      return this.error("Invalid type ID", 400);
    }

    const typeService = new TypeService();

    try {
      const type = await typeService.getType(typeId);

      if (!type) {
        return this.error("Type not found", 404);
      }

      return this.success(type);
    } catch (error) {
      console.error(`Error fetching type ${typeId}:`, error);
      return this.error("Failed to fetch type", 500);
    }
  }
}
