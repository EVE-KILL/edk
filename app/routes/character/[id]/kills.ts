import { WebController } from "../../../../src/controllers/web-controller";
import { generateKilllist } from "../../../generators/killlist";
import { db } from "../../../../src/db";
import {
  characters,
  killmails as killmailsTable,
  victims,
  attackers
} from "../../../../db/schema";
import { eq } from "drizzle-orm";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 300,
    vary: ["id", "page"],
  };

  override async handle(): Promise<Response> {
    const characterId = this.getParam("id");

    if (!characterId) {
      return this.notFound("Character not found");
    }

    const characterIdInt = parseInt(characterId, 10);

    // Get character info
    const character = await db
      .select({
        id: characters.characterId,
        name: characters.name,
      })
      .from(characters)
      .where(eq(characters.characterId, characterIdInt))
      .limit(1)
      .then((r) => r[0]);

    if (!character) {
      return this.notFound(`Character #${characterId} not found`);
    }

    // Get stats (kills and losses count)
    const killCount = await db
      .select({ count: killmailsTable.id })
      .from(attackers)
      .innerJoin(killmailsTable, eq(killmailsTable.id, attackers.killmailId))
      .where(eq(attackers.characterId, characterIdInt));

    const kills = killCount.length;

    const lossCount = await db
      .select({ count: victims.id })
      .from(victims)
      .innerJoin(killmailsTable, eq(killmailsTable.id, victims.killmailId))
      .where(eq(victims.characterId, characterIdInt));

    const losses = lossCount.length;

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

    // Fetch character kills with pagination
    const killmails = await generateKilllist(limit + 1, {
      characterIds: [parseInt(characterId, 10)],
      killsOnly: true,
      offset
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop();
    }

    const hasPrevPage = currentPage > 1;

    // For now, we don't have total kill count, so we'll use a high number
    // TODO: Add a query to get total kill count for accurate page numbers
    const totalPages = 999; // Unknown total

    // Calculate page numbers to display
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    const data = {
      character,
      stats,
      killmails,
      currentTab: 'kills',
      pagination: {
        currentPage,
        totalPages: null, // We don't know total yet
        hasNextPage,
        hasPrevPage,
        nextPageUrl: hasNextPage ? `/character/${characterId}/kills?page=${currentPage + 1}` : null,
        prevPageUrl: hasPrevPage ? (currentPage > 2 ? `/character/${characterId}/kills?page=${currentPage - 1}` : `/character/${characterId}/kills`) : null,
        pages,
        showFirst: startPage > 1,
        showLast: hasNextPage && endPage < totalPages,
      },
    };

    return await this.renderPage(
      "pages/character-kills",
      `${character.name} - Kills`,
      `Kill history for ${character.name}`,
      data
    );
  }
}
