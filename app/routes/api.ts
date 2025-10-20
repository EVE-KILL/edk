import { WebController } from "../../src/controllers/web-controller";

export class Controller extends WebController {
  async handle(): Promise<Response> {
    const baseUrl = `${this.url.protocol}//${this.url.host}`;

    const data = {
      baseUrl
    };

    return await this.renderPage(
      "pages/api",
      "API Documentation - EVE Kill v4",
      "Complete API documentation for EVE Kill v4. Learn how to integrate with our REST API for killmail data, user statistics, and more.",
      data
    );
  }
}
