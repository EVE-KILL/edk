import { WebController } from "../../../src/controllers/web-controller";
import { generateCorporationDetail } from "../../generators/corporation";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 300,
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const corporationId = this.getParam("id");

    if (!corporationId) {
      return this.notFound("Corporation not found");
    }

    const corporationDetail = await generateCorporationDetail(parseInt(corporationId, 10));

    if (!corporationDetail) {
      return this.notFound(`Corporation #${corporationId} not found`);
    }

    const data = {
      ...corporationDetail,
      entityName: corporationDetail.corporation.name,
      ticker: corporationDetail.corporation.ticker,
      imageUrl: `https://images.evetech.net/corporations/${corporationDetail.corporation.id}/logo?size=64`,
      currentTab: "dashboard",
      baseUrl: `/corporation/${corporationId}`,
    };

    return await this.renderPage(
      "pages/corporation-detail",
      `${corporationDetail.corporation.name}`,
      `Corporation profile for ${corporationDetail.corporation.name}`,
      data
    );
  }
}
