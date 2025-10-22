import { ApiController } from "../../../../src/controllers/api-controller";
import { characterService } from "../../../services/esi/character-service";

/**
 * Character API Controller
 * GET /api/characters/:id - Get character by ID
 */
export class Controller extends ApiController {
  // Cache character API responses
  static cacheConfig = {
    ttl: 120,                    // Fresh for 2 minutes
    staleWhileRevalidate: 300,   // Serve stale for 5 more minutes while refreshing
  };

  override async get(): Promise<Response> {
    const characterIdStr = this.getParam("id");

    if (!characterIdStr) {
      return this.error("Character ID is required", 400);
    }

    const characterId = parseInt(characterIdStr);

    if (isNaN(characterId)) {
      return this.error("Invalid character ID", 400);
    }

    try {
      const character = await characterService.getCharacter(characterId);
      return this.success(character);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.error(errorMessage, 500);
    }
  }
}
