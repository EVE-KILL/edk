import { WebController } from "../../src/controllers/web-controller";

export class Controller extends WebController {
  async handle(): Promise<Response> {
    const data = {};

    return await this.renderPage(
      "pages/post",
      "Post Killmail - EVE Kill v4",
      "Post a killmail from ESI to EVE Kill v4",
      data
    );
  }
}
