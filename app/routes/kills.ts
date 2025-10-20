import { WebController } from "../../src/controllers/web-controller";

export class Controller extends WebController {
  async handle(): Promise<Response> {
    const data = {};

    return await this.renderPage(
      "pages/kills",
      "Kills - EVE Kill v4",
      "Browse recent killmails on EVE Kill v4",
      data
    );
  }
}
