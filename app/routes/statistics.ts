import { WebController } from "../../src/controllers/web-controller";

export class Controller extends WebController {
  async handle(): Promise<Response> {
    // Parse followed entities from environment variables
    const followedCharacters = process.env.FOLLOWED_CHARACTER_IDS
      ? process.env.FOLLOWED_CHARACTER_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : [];

    const followedCorporations = process.env.FOLLOWED_CORPORATION_IDS
      ? process.env.FOLLOWED_CORPORATION_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : [];

    const followedAlliances = process.env.FOLLOWED_ALLIANCE_IDS
      ? process.env.FOLLOWED_ALLIANCE_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : [];

    const data = {
      characters: followedCharacters,
      corporations: followedCorporations,
      alliances: followedAlliances,
      hasEntities: followedCharacters.length > 0 || followedCorporations.length > 0 || followedAlliances.length > 0
    };

    return await this.renderPage(
      "pages/statistics",
      "Statistics - EVE Kill v4",
      "View statistics for followed characters, corporations, and alliances",
      data
    );
  }
}
