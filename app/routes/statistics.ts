import { WebController } from "../../src/controllers/web-controller";

export class Controller extends WebController {
  async handle(): Promise<Response> {
    // followedEntities is now available in all templates via getCommonTemplateData()
    const data = {};

    return await this.renderPage(
      "pages/statistics",
      "Statistics - EVE Kill v4",
      "View statistics for followed characters, corporations, and alliances",
      data
    );
  }
}
