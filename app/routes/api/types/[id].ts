import { ApiController } from "../../../../src/controllers/api-controller";
import { types } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export class Controller extends ApiController {
  // Type data is static - cache for 7 days
  static cacheConfig = {
    ttl: 604800,
    staleWhileRevalidate: 604800,
    vary: ["id"],
  };

  override async get() {
    const { id } = this.params;

    if (!id) {
      return this.error("Type ID required", 400);
    }

    const typeId = Number.parseInt(id);

    if (Number.isNaN(typeId)) {
      return this.error("Invalid type ID", 400);
    }

    try {
      const type = await this.db
        .select()
        .from(types)
        .where(eq(types.typeId, typeId))
        .get();

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
