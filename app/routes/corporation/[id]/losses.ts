import { WebController } from "../../../../src/controllers/web-controller";
import { generateKilllist } from "../../../generators/killlist";
import { generateCorporationDetail } from "../../../generators/corporation";

export class Controller extends WebController {
  static methods = ["GET"];

  override async handle(): Promise<Response> {
    const corporationId = this.getParam("id");
    if (!corporationId) {
      return this.notFound("Corporation not found");
    }

    const currentPage = parseInt(this.getQuery("page") || "1");
    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Fetch corporation and stats
    const corporationDetail = await generateCorporationDetail(parseInt(corporationId, 10));
    if (!corporationDetail) {
      return this.notFound(`Corporation #${corporationId} not found`);
    }

    const { corporation, stats } = corporationDetail;

    // Fetch losses with limit+1 to check for next page
    const killmails = await generateKilllist(limit + 1, {
      corporationIds: [parseInt(corporationId)],
      lossesOnly: true,
      offset,
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop(); // Remove the extra item
    }

    // Generate pagination URLs
    const baseUrl = `/corporation/${corporationId}/losses`;
    const hasPrevPage = currentPage > 1;

    // Calculate page range (show 5 pages)
    const totalPages = Math.ceil(stats.losses / limit);
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return await this.renderPage(
      "pages/corporation-losses",
      `${corporation.name} - Losses`,
      `Losses for ${corporation.name}`,
      {
        entityName: corporation.name,
        ticker: corporation.ticker,
        imageUrl: `https://images.evetech.net/corporations/${corporation.id}/logo?size=64`,
        stats,
        killmails,
        currentTab: "losses",
        baseUrl: `/corporation/${corporationId}`,
        pagination: {
          currentPage,
          hasPrevPage,
          hasNextPage,
          prevUrl: hasPrevPage
            ? currentPage === 2
              ? baseUrl
              : `${baseUrl}?page=${currentPage - 1}`
            : null,
          nextUrl: hasNextPage ? `${baseUrl}?page=${currentPage + 1}` : null,
          firstUrl: baseUrl,
          lastUrl:
            totalPages > 1 ? `${baseUrl}?page=${totalPages}` : baseUrl,
          basePageUrl: baseUrl,
          pages,
          totalPages,
          showFirst: startPage > 1,
          showLast: hasNextPage,
        },
      }
    );
  }
}
