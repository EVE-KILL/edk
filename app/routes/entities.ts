import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist } from "../generators/killlist";
import {
  getKillsStatistics,
  getLossesStatistics,
  type StatsFilters,
} from "../generators/statistics";
import { characters, corporations, alliances } from "../../db/schema";
import { inArray } from "drizzle-orm";
import { db } from "../../src/db";
import {
  getShipGroupCombinedStatistics,
  type ShipGroupStatsFilters,
} from "../generators/ship-group-stats";

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

// Build stats filters from .env
const statsFilters: StatsFilters | undefined = HAS_FOLLOWED_ENTITIES
  ? {
      characterIds:
        FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
      corporationIds:
        FOLLOWED_CORPORATION_IDS.length > 0
          ? FOLLOWED_CORPORATION_IDS
          : undefined,
      allianceIds:
        FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
    }
  : undefined;

export class Controller extends WebController {
  override async handle(): Promise<Response> {
    // If no followed entities are configured, show a placeholder page
    if (!HAS_FOLLOWED_ENTITIES) {
      const data = {
        hasEntities: false,
      };

      return await this.renderPage(
        "pages/entities",
        "Entities - EVE Kill v4",
        "View statistics for followed entities",
        data
      );
    }

    // Fetch entity names
    const [characterNames, corporationNames, allianceNames] = await Promise.all([
      FOLLOWED_CHARACTER_IDS.length > 0
        ? db
            .select({ id: characters.characterId, name: characters.name })
            .from(characters)
            .where(inArray(characters.characterId, FOLLOWED_CHARACTER_IDS))
        : [],
      FOLLOWED_CORPORATION_IDS.length > 0
        ? db
            .select({ id: corporations.corporationId, name: corporations.name })
            .from(corporations)
            .where(inArray(corporations.corporationId, FOLLOWED_CORPORATION_IDS))
        : [],
      FOLLOWED_ALLIANCE_IDS.length > 0
        ? db
            .select({ id: alliances.allianceId, name: alliances.name })
            .from(alliances)
            .where(inArray(alliances.allianceId, FOLLOWED_ALLIANCE_IDS))
        : [],
    ]);

    // Build entity list for display
    const entityList = [
      ...characterNames.map((c) => ({ type: "character", id: c.id, name: c.name })),
      ...corporationNames.map((c) => ({ type: "corporation", id: c.id, name: c.name })),
      ...allianceNames.map((a) => ({ type: "alliance", id: a.id, name: a.name })),
    ];

    // Build entity image URLs for collage
    const entityImages = [
      ...characterNames.map((c) => `https://images.evetech.net/characters/${c.id}/portrait?size=128`),
      ...corporationNames.map((c) => `https://images.evetech.net/corporations/${c.id}/logo?size=128`),
      ...allianceNames.map((a) => `https://images.evetech.net/alliances/${a.id}/logo?size=128`),
    ];

    // Build ship group stats filters
    const shipGroupFilters: ShipGroupStatsFilters = {
      characterIds: FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
      corporationIds: FOLLOWED_CORPORATION_IDS.length > 0 ? FOLLOWED_CORPORATION_IDS : undefined,
      allianceIds: FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
    };

    // Fetch ship group statistics for the last 30 days (combined kills + losses)
    const shipGroupStats = await getShipGroupCombinedStatistics(30, shipGroupFilters);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    // Fetch recent activity (last 20, both kills and losses)
    const recentKillmails = await generateKilllist(20, {
      characterIds:
        FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
      corporationIds:
        FOLLOWED_CORPORATION_IDS.length > 0
          ? FOLLOWED_CORPORATION_IDS
          : undefined,
      allianceIds:
        FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
    });

    // Fetch comprehensive statistics
    const killStats = await getKillsStatistics(statsFilters);
    const lossStats = await getLossesStatistics(statsFilters);

    // Combine stats
    const totalISKDestroyed = parseFloat(killStats?.totalISKDestroyed || "0");
    const totalISKLost = parseFloat(lossStats?.totalISKLost || "0");
    const efficiency =
      totalISKDestroyed + totalISKLost > 0
        ? ((totalISKDestroyed / (totalISKDestroyed + totalISKLost)) * 100).toFixed(2)
        : "0.00";

    const stats = {
      totalKills: killStats?.totalKills || 0,
      totalValue: killStats?.totalISKDestroyed || "0",
      totalLosses: lossStats?.totalLosses || 0,
      totalValueLost: lossStats?.totalISKLost || "0",
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
      imageUrl: entityImages.length > 0 ? entityImages[0] : "https://images.evetech.net/alliances/1/logo?size=128",
      entityImages, // For collage display
      currentTab: "dashboard",
      baseUrl: "/entities",
      // Entity list for display
      entityList,
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
      // Statistics for the entity-header component (using the stats object format)
      stats: {
        kills: killStats?.totalKills || 0,
        losses: lossStats?.totalLosses || 0,
        killLossRatio:
          (lossStats?.totalLosses || 0) > 0
            ? ((killStats?.totalKills || 0) / (lossStats?.totalLosses || 0)).toFixed(2)
            : (killStats?.totalKills || 0).toString(),
        efficiency,
        iskDestroyed: killStats?.totalISKDestroyed || "0",
        iskLost: lossStats?.totalISKLost || "0",
        iskEfficiency: efficiency,
      },
    };

    return await this.renderPage(
      "pages/entities",
      "Entities - EVE Kill v4",
      "View statistics for followed entities",
      data
    );
  }
}
