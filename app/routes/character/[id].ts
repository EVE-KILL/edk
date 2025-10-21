import { WebController } from "../../../src/controllers/web-controller";
import { generateCharacterDetail } from "../../generators/character";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 300,
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const characterId = this.getParam("id");

    if (!characterId) {
      return this.notFound("Character not found");
    }

    const characterDetail = await generateCharacterDetail(parseInt(characterId, 10));

    if (!characterDetail) {
      return this.notFound(`Character #${characterId} not found`);
    }

    const data = {
      ...characterDetail,
      currentTab: 'dashboard',
    };

    return await this.renderPage(
      "pages/character-detail",
      `${characterDetail.character.name}`,
      `Character profile for ${characterDetail.character.name}`,
      data
    );
  }
}
