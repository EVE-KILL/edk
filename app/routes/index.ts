import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist, getKillboardStats } from "../generators/killlist";

export class Controller extends WebController {
  override async handle(): Promise<Response> {
    try {
      // Fetch real data from database
      const [killmails, statistics] = await Promise.all([
        generateKilllist(20),
        getKillboardStats(),
      ]);

      const data = {
        config: {
          title: "EVE Kill v4",
          subtitle: "The Ultimate EVE Online Killboard"
        },
        killmails,
        statistics,
      };

      return await this.renderPage(
        "pages/home",
        "EVE Kill v4",
        "Track EVE Online killmails with classic EVEDEV-KB layout. Real-time killmail tracking and comprehensive statistics.",
        data
      );
    } catch (error) {
      console.error("Error loading home page:", error);

      // Fallback to empty data if there's an error
      const data = {
        config: {
          title: "EVE Kill v4",
          subtitle: "The Ultimate EVE Online Killboard"
        },
        killmails: [],
        statistics: {
          totalKillmails: 0,
          totalISK: 0,
          activePilots: 0,
          recentKills: 0,
        },
      };

      return await this.renderPage(
        "pages/home",
        "EVE Kill v4",
        "Track EVE Online killmails with classic EVEDEV-KB layout. Real-time killmail tracking and comprehensive statistics.",
        data
      );
    }
  }
}
