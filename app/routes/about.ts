import { WebController } from "../../src/controllers/web-controller";
import { getKillboardStatistics } from "../generators/statistics";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 60,                     // Cache for 60 seconds
    staleWhileRevalidate: 120,   // Serve stale for 120 more seconds while refreshing
  };

  override async handle(): Promise<Response> {
    try {
      // Fetch comprehensive statistics
      const statistics = await getKillboardStatistics();

      const data = {
        config: {
          title: "About - EDK"
        },
        statistics,
      };

      return await this.renderPage(
        "pages/about",
        "About - EDK",
        "Killboard statistics and information about EDK.",
        data
      );
    } catch (error) {
      console.error("Error loading about page:", error);

      // Fallback to empty data if there's an error
      const data = {
        config: {
          title: "About - EDK"
        },
        statistics: {
          totalKillmails: 0,
          totalISKDestroyed: 0,
          soloKills: 0,
          npcKills: 0,
          averageAttackersPerKill: 0,
          totalUniquePilots: 0,
          activePilotsLast24Hours: 0,
          activePilotsLast7Days: 0,
          killsLast24Hours: 0,
          killsLast7Days: 0,
          killsLast30Days: 0,
        },
      };

      return await this.renderPage(
        "pages/about",
        "About - EDK",
        "Killboard statistics and information about EDK.",
        data
      );
    }
  }
}
