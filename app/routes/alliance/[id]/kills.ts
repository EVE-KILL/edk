import { WebController } from "../../../../src/controllers/web-controller";
import { generateKilllist } from "../../../generators/killlist";
import { generateAllianceDetail } from "../../../generators/alliance";

export class Controller extends WebController {
  static methods = ["GET"];

  override async handle(): Promise<Response> {
    const allianceId = this.getParam("id");
    if (!allianceId) {
      return this.notFound("Alliance not found");
    }

    const currentPage = parseInt(this.getQuery("page") || "1");
    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Fetch alliance and stats
    const allianceDetail = await generateAllianceDetail(parseInt(allianceId, 10));
    if (!allianceDetail) {
      return this.notFound(`Alliance #${allianceId} not found`);
    }

    const { alliance, stats } = allianceDetail;

    // Fetch kills with limit+1 to check for next page
    const killmails = await generateKilllist(limit + 1, {
      allianceIds: [parseInt(allianceId)],
      killsOnly: true,
      offset,
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop(); // Remove the extra item
    }

    // Generate pagination URLs
    const baseUrl = `/alliance/${allianceId}/kills`;
    const hasPrevPage = currentPage > 1;

    // Calculate page range (show 5 pages)
    const totalPages = Math.ceil(stats.kills / limit);
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
      "pages/alliance-kills",
      `${alliance.name} - Kills`,
      `Kills for ${alliance.name}`,
      {
        entityName: alliance.name,
        ticker: alliance.ticker,
        imageUrl: `https://images.evetech.net/alliances/${alliance.id}/logo?size=512`,
        stats,
        killmails,
        currentTab: "kills",
        baseUrl: `/alliance/${allianceId}`,
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
