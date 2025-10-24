import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist } from "../generators/killlist";
import { getEntityStats } from "../generators/entity-stats";
import { characters, corporations, alliances } from "../../db/schema";
import { inArray } from "drizzle-orm";
import { db } from "../../src/db";
import {
  getShipGroupCombinedStatistics,
  type ShipGroupStatsFilters,
} from "../generators/ship-group-stats";
import { getTop10StatsByEntities } from "../generators/top-10-stats";
import { getMostValuableKills } from "../generators/mostvaluable";

// Parse .env followed entities configuration
const FOLLOWED_CHARACTER_IDS =
  process.env.FOLLOWED_CHARACTER_IDS?.trim()
    ? process.env.FOLLOWED_CHARACTER_IDS.split(",").map((id) =>
        parseInt(id.trim(), 10)
      )
    : [];
const FOLLOWED_CORPORATION_IDS =
  process.env.FOLLOWED_CORPORATION_IDS?.trim()
    ? process.env.FOLLOWED_CORPORATION_IDS.split(",").map((id) =>
        parseInt(id.trim(), 10)
      )
    : [];
const FOLLOWED_ALLIANCE_IDS =
  process.env.FOLLOWED_ALLIANCE_IDS?.trim()
    ? process.env.FOLLOWED_ALLIANCE_IDS.split(",").map((id) =>
        parseInt(id.trim(), 10)
      )
    : [];

// Check if we have any followed entities
const HAS_FOLLOWED_ENTITIES =
  FOLLOWED_CHARACTER_IDS.length > 0 ||
  FOLLOWED_CORPORATION_IDS.length > 0 ||
  FOLLOWED_ALLIANCE_IDS.length > 0;

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 30,                     // Fresh for 30 seconds
    staleWhileRevalidate: 60,    // Serve stale for 60 more seconds while refreshing
  };
  override async handle(): Promise<Response> {
    // If no followed entities are configured, show a placeholder page
    if (!HAS_FOLLOWED_ENTITIES) {
      const data = {
        hasEntities: false,
      };

      return await this.renderPage(
        "pages/entities",
        "Entities - EDK",
        "View statistics for followed entities",
        data
      );
    }

    // PHASE 1: Batch fetch all entity names in a single optimized query batch
    // Instead of 3 separate queries, batch them with Promise.all
    const [characterNames, corporationNames, allianceNames] = await Promise.all([
      FOLLOWED_CHARACTER_IDS.length > 0
        ? db
            .select({ id: characters.characterId, name: characters.name })
            .from(characters)
            .where(inArray(characters.characterId, FOLLOWED_CHARACTER_IDS))
        : Promise.resolve([]),
      FOLLOWED_CORPORATION_IDS.length > 0
        ? db
            .select({ id: corporations.corporationId, name: corporations.name })
            .from(corporations)
            .where(inArray(corporations.corporationId, FOLLOWED_CORPORATION_IDS))
        : Promise.resolve([]),
      FOLLOWED_ALLIANCE_IDS.length > 0
        ? db
            .select({ id: alliances.allianceId, name: alliances.name })
            .from(alliances)
            .where(inArray(alliances.allianceId, FOLLOWED_ALLIANCE_IDS))
        : Promise.resolve([]),
    ]);

    // Build entity list for display
    const entityList = [
      ...characterNames.map((c) => ({ type: "character", id: c.id, name: c.name })),
      ...corporationNames.map((c) => ({ type: "corporation", id: c.id, name: c.name })),
      ...allianceNames.map((a) => ({ type: "alliance", id: a.id, name: a.name })),
    ];

    // Build entity image URLs for collage
    const entityImages = [
      ...characterNames.map((c) => `https://images.eve-kill.com/characters/${c.id}/portrait?size=128`),
      ...corporationNames.map((c) => `https://images.eve-kill.com/corporations/${c.id}/logo?size=128`),
      ...allianceNames.map((a) => `https://images.eve-kill.com/alliances/${a.id}/logo?size=128`),
    ];

    // PHASE 2: Fetch all major data sets in parallel
    // These are all independent queries, so we parallelize them with Promise.all
    const [
      entityStats,
      shipGroupStats,
      recentKillmails,
      top10Stats,
      mostValuableKills,
    ] = await Promise.all([
      // Unified statistics query - much faster than separate kills/losses queries
      getEntityStats({
        characterIds: FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
        corporationIds: FOLLOWED_CORPORATION_IDS.length > 0 ? FOLLOWED_CORPORATION_IDS : undefined,
        allianceIds: FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
      }),

      // Ship group statistics
      getShipGroupCombinedStatistics(30, {
        characterIds: FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
        corporationIds: FOLLOWED_CORPORATION_IDS.length > 0 ? FOLLOWED_CORPORATION_IDS : undefined,
        allianceIds: FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
      }),

      // Recent activity (last 20, both kills and losses)
      generateKilllist(20, {
        characterIds: FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
        corporationIds: FOLLOWED_CORPORATION_IDS.length > 0 ? FOLLOWED_CORPORATION_IDS : undefined,
        allianceIds: FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
      }),

      // Top 10 stats for the tracked entities
      getTop10StatsByEntities(
        FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
        FOLLOWED_CORPORATION_IDS.length > 0 ? FOLLOWED_CORPORATION_IDS : undefined,
        FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
        7
      ),

      // Most valuable kills (last 7 days, top 6)
      getMostValuableKills({
        limit: 6,
        days: 7,
        characterIds: FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
        corporationIds: FOLLOWED_CORPORATION_IDS.length > 0 ? FOLLOWED_CORPORATION_IDS : undefined,
        allianceIds: FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
      }),
    ]);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    // Extract and format statistics
    const efficiency =
      parseFloat(entityStats.iskDestroyed) + parseFloat(entityStats.iskLost) > 0
        ? (parseFloat(entityStats.iskDestroyed) / (parseFloat(entityStats.iskDestroyed) + parseFloat(entityStats.iskLost)) * 100).toFixed(2)
        : "0.00";

    const stats = {
      totalKills: entityStats.kills,
      totalValue: entityStats.iskDestroyed,
      totalLosses: entityStats.losses,
      totalValueLost: entityStats.iskLost,
      efficiency,
    };

    const data = {
      hasEntities: true,
      recentKillmails,
      characterIds: FOLLOWED_CHARACTER_IDS,
      corporationIds: FOLLOWED_CORPORATION_IDS,
      allianceIds: FOLLOWED_ALLIANCE_IDS,
      // Add entity data for the entity-header component
      entityName: "Tracked Entities",
      entityType: "entities",
      imageUrl: entityImages.length > 0 ? entityImages[0] : "https://images.eve-kill.com/alliances/1/logo?size=128",
      entityImages, // For collage display
      currentTab: "dashboard",
      baseUrl: "/entities",
      // Entity list for display
      entityList,
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
      // Top 10 stats for sidebar
      top10Stats,
      // Most valuable kills
      mostValuableKills,
      // Filter config for WebSocket killlist updates (multi-entity)
      filterConfig: {
        characterIds: FOLLOWED_CHARACTER_IDS,
        corporationIds: FOLLOWED_CORPORATION_IDS,
        allianceIds: FOLLOWED_ALLIANCE_IDS,
      },
      // Statistics for the entity-header component (using the stats object format)
      stats: {
        kills: entityStats.kills,
        losses: entityStats.losses,
        killLossRatio: entityStats.killLossRatio.toString(),
        efficiency,
        iskDestroyed: entityStats.iskDestroyed,
        iskLost: entityStats.iskLost,
        iskEfficiency: efficiency,
      },
    };

    return await this.renderPage(
      "pages/entities",
      "Entities - EDK",
      "View statistics for followed entities",
      data
    );
  }
}
