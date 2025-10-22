import { WebController } from "../../../src/controllers/web-controller";
import { generateCharacterDetail } from "../../generators/character";
import {
  getShipGroupCombinedStatistics,
  type ShipGroupStatsFilters,
} from "../../generators/ship-group-stats";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 120,                    // Fresh for 2 minutes
    staleWhileRevalidate: 300,   // Serve stale for 5 more minutes while refreshing
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const characterId = this.getParam("id");

    if (!characterId) {
      return this.notFound("Character not found");
    }

    const characterDetail = await generateCharacterDetail(parseInt(characterId, 10));

    if (!characterDetail) {
      return this.notFound(`Character #${characterId} not found`);
    }

    // Fetch ship group combined statistics for last 30 days
    const shipGroupFilters: ShipGroupStatsFilters = {
      characterIds: [parseInt(characterId, 10)],
    };
    const shipGroupStats = await getShipGroupCombinedStatistics(30, shipGroupFilters);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    const data = {
      ...characterDetail,
      entityName: characterDetail.character.name,
      imageUrl: `https://images.evetech.net/characters/${characterDetail.character.id}/portrait?size=512`,
      currentTab: 'dashboard',
      baseUrl: `/character/${characterId}`,
      // Entity info for loss highlighting
      entityType: 'character',
      entityId: parseInt(characterId, 10),
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
    };

    return await this.renderPage(
      "pages/character-detail",
      `${characterDetail.character.name}`,
      `Character profile for ${characterDetail.character.name}`,
      data
    );
  }
}
