import { WebController } from "../../../src/controllers/web-controller";
import { generateAllianceDetail } from "../../generators/alliance";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 300,
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const allianceId = this.getParam("id");

    if (!allianceId) {
      return this.notFound("Alliance not found");
    }

    const allianceDetail = await generateAllianceDetail(parseInt(allianceId, 10));

    if (!allianceDetail) {
      return this.notFound(`Alliance #${allianceId} not found`);
    }

    const data = {
      ...allianceDetail,
    };

    return await this.renderPage(
      "pages/alliance-detail",
      `${allianceDetail.alliance.name}`,
      `Alliance profile for ${allianceDetail.alliance.name}`,
      data
    );
  }
}
