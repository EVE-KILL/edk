import { WebController } from "../../../src/controllers/web-controller";
import { generateCharacterDetail } from "../../generators/character";
import {
  getShipGroupCombinedStatistics,
  type ShipGroupStatsFilters,
} from "../../generators/ship-group-stats";
import { getTop10StatsByCharacter } from "../../generators/top-10-stats";
import { getMostValuableKills } from "../../generators/mostvaluable";

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

    // Fetch top 10 stats specific to this character
    const top10Stats = await getTop10StatsByCharacter(parseInt(characterId, 10), 7);

    // Fetch most valuable kills for this character (last 7 days, top 6)
    const mostValuableKills = await getMostValuableKills({
      limit: 6,
      days: 7,
      characterIds: [parseInt(characterId, 10)],
    });

    const data = {
      ...characterDetail,
      entityName: characterDetail.character.name,
      entityId: characterDetail.character.id,
      entityType: 'character',
      type: 'character',
      imageUrl: `https://images.eve-kill.com/characters/${characterDetail.character.id}/portrait?size=512`,
      ticker: undefined,
      parent: characterDetail.character.corporationId ? {
        id: characterDetail.character.corporationId,
        name: characterDetail.character.corporationName,
        ticker: characterDetail.character.corporationTicker,
      } : undefined,
      grandparent: characterDetail.character.allianceId ? {
        id: characterDetail.character.allianceId,
        name: characterDetail.character.allianceName,
        ticker: characterDetail.character.allianceTicker,
      } : undefined,
      currentTab: 'dashboard',
      baseUrl: `/character/${characterId}`,
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
      // Top 10 statistics
      top10Stats,
      // Most valuable kills
      mostValuableKills,
      // Filter config for WebSocket killlist updates
      filterConfig: {
        type: 'all',
        characterIds: [parseInt(characterId, 10)],
      },
    };

    // Use streaming for better TTFB on character pages with lots of data
    return await this.renderPage(
      "pages/character-detail",
      `${characterDetail.character.name}`,
      `Character profile for ${characterDetail.character.name}`,
      data
    );
  }
}
