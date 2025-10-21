import { WebController } from "../../../../src/controllers/web-controller";
import { generateKilllist } from "../../../generators/killlist";
import { db } from "../../../../src/db";
import {
  characters,
  killmails,
  victims,
  attackers,
} from "../../../../db/schema";
import { eq, sql } from "drizzle-orm";

export class Controller extends WebController {
  override async handle(): Promise<Response> {
    const characterId = this.getParam("id");

    if (!characterId) {
      return this.notFound("Character not found");
    }

    // Fetch character info
    const character = await db
      .select({
        id: characters.characterId,
        name: characters.name,
        corporationId: characters.corporationId,
        allianceId: characters.allianceId,
      })
      .from(characters)
      .where(eq(characters.characterId, parseInt(characterId, 10)))
      .limit(1)
      .execute();

    if (!character || character.length === 0) {
      return this.notFound(`Character #${characterId} not found`);
    }

    const char = character[0];

    // Calculate stats
    const killsResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${attackers.killmailId})` })
      .from(attackers)
      .where(eq(attackers.characterId, parseInt(characterId, 10)))
      .execute();

    const lossesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(victims)
      .where(eq(victims.characterId, parseInt(characterId, 10)))
      .execute();

    const kills = killsResult[0]?.count || 0;
    const losses = lossesResult[0]?.count || 0;

    const stats = {
      kills,
      losses,
      killLossRatio: losses > 0 ? kills / losses : kills,
      totalDamageDone: 0,
      efficiency: kills + losses > 0 ? (kills / (kills + losses)) * 100 : 0,
    };

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

    const data = {
      character: char,
      stats,
      killmails,
      entityName: char.name,
      imageUrl: `https://images.evetech.net/characters/${char.id}/portrait?size=64`,
      currentTab: 'losses',
      baseUrl: `/character/${characterId}`,
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
      `${char.name} - Losses`,
      `Loss history for ${char.name}`,
      data
    );
  }
}
