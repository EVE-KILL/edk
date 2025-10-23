import { WebController } from "../../src/controllers/web-controller";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 60,
    staleWhileRevalidate: 120,
  };

  override async handle(): Promise<Response> {
    // followedEntities is now available in all templates via getCommonTemplateData()
    const data = {};

    return await this.renderPage(
      "pages/statistics",
      "Statistics - EDK",
      "View statistics for followed characters, corporations, and alliances",
      data
    );
  }
}
