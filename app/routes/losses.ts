import { WebController } from "../../src/controllers/web-controller";

// Parse .env followed entities configuration
const FOLLOWED_CHARACTER_IDS = process.env.FOLLOWED_CHARACTER_IDS?.trim()
  ? process.env.FOLLOWED_CHARACTER_IDS.split(",").map((id) => parseInt(id.trim(), 10))
  : [];
const FOLLOWED_CORPORATION_IDS = process.env.FOLLOWED_CORPORATION_IDS?.trim()
  ? process.env.FOLLOWED_CORPORATION_IDS.split(",").map((id) => parseInt(id.trim(), 10))
  : [];
const FOLLOWED_ALLIANCE_IDS = process.env.FOLLOWED_ALLIANCE_IDS?.trim()
  ? process.env.FOLLOWED_ALLIANCE_IDS.split(",").map((id) => parseInt(id.trim(), 10))
  : [];

// Check if we have any followed entities
const HAS_FOLLOWED_ENTITIES =
  FOLLOWED_CHARACTER_IDS.length > 0 ||
  FOLLOWED_CORPORATION_IDS.length > 0 ||
  FOLLOWED_ALLIANCE_IDS.length > 0;

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 30,
    staleWhileRevalidate: 60,
    vary: ["page"],
  };

  override async handle(): Promise<Response> {
    // If no followed entities are configured, redirect to kills
    if (!HAS_FOLLOWED_ENTITIES) {
      return Response.redirect(`${new URL(this.request.url).origin}/kills`, 302);
    }

    // If entities ARE configured, redirect to entities/losses
    return Response.redirect(`${new URL(this.request.url).origin}/entities/losses`, 302);
  }
}
