import { WebController } from "../../../../src/controllers/web-controller";
import { generateKilllist } from "../../../generators/killlist";
import { generateCharacterDetail } from "../../../generators/character";
import { db } from "../../../../src/db";
import {
  characters,
} from "../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  getShipGroupLossStatistics,
  type ShipGroupStatsFilters,
} from "../../../generators/ship-group-stats";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 60,
    staleWhileRevalidate: 120,
    vary: ["id", "page"],
  };

  override async handle(): Promise<Response> {
    const characterId = this.getParam("id");

    if (!characterId) {
      return this.notFound("Character not found");
    }

    const characterIdInt = parseInt(characterId, 10);

    // Get full character stats (reuse the generator for consistency)
    const characterDetail = await generateCharacterDetail(characterIdInt);

    if (!characterDetail) {
      return this.notFound(`Character #${characterId} not found`);
    }

    const character = characterDetail.character;
    const stats = characterDetail.stats;

    // Get pagination parameters
    const url = new URL(this.request.url);
    const pageParam = url.searchParams.get("page");
    const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Fetch character losses with pagination
    const killmails = await generateKilllist(limit + 1, {
      characterIds: [parseInt(characterId, 10)],
      lossesOnly: true,
      offset
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop();
    }

    const hasPrevPage = currentPage > 1;

    // For now, we don't have total loss count, so we'll use a high number
    // TODO: Add a query to get total loss count for accurate page numbers
    const totalPages = 999; // Unknown total

    // Calculate page numbers to display
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    // Adjust if we're near the end
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Fetch ship group loss statistics for last 30 days
    const shipGroupFilters: ShipGroupStatsFilters = {
      characterIds: [characterIdInt],
    };
    const shipGroupStats = await getShipGroupLossStatistics(30, shipGroupFilters);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    const data = {
      character,
      stats,
      killmails,
      entityName: character.name,
      imageUrl: `https://images.evetech.net/characters/${character.id}/portrait?size=512`,
      currentTab: 'losses',
      baseUrl: `/character/${characterId}`,
      // Entity info for loss highlighting
      entityType: 'character',
      entityId: characterIdInt,
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
      pagination: {
        currentPage,
        totalPages: null, // We don't know total yet
        hasNextPage,
        hasPrevPage,
        nextPageUrl: hasNextPage ? `/character/${characterId}/losses?page=${currentPage + 1}` : null,
        prevPageUrl: hasPrevPage ? (currentPage > 2 ? `/character/${characterId}/losses?page=${currentPage - 1}` : `/character/${characterId}/losses`) : null,
        pages,
        showFirst: startPage > 1,
        showLast: hasNextPage && endPage < totalPages,
      },
    };

    return await this.renderPage(
      "pages/character-losses",
      `${character.name} - Losses`,
      `Loss history for ${character.name}`,
      data
    );
  }
}
