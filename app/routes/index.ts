import { WebController } from "../utils/web-controller";

export class Controller extends WebController {
  async handle(): Promise<Response> {
    // Mock data - in real app this would come from your database
    const data = {
      stats: {
        totalKillmails: 15847293,
        totalISK: 847293847293847,
        activePilots: 12847,
        recentKills: 1847
      },
      recentKillmails: [
        {
          id: 123456,
          victim: {
            character: { name: "Test Pilot Alpha" },
            ship: { name: "Rifter" }
          },
          value: 15847293,
          timestamp: new Date(Date.now() - 1000 * 60 * 15)
        },
        {
          id: 123457,
          victim: {
            character: { name: "Beta Tester" },
            ship: { name: "Stabber" }
          },
          value: 847293847,
          timestamp: new Date(Date.now() - 1000 * 60 * 45)
        },
        {
          id: 123458,
          victim: {
            character: { name: "Gamma Squadron" },
            ship: { name: "Hurricane" }
          },
          value: 2847293847,
          timestamp: new Date(Date.now() - 1000 * 60 * 120)
        }
      ]
    };

    return await this.renderPage(
      "pages/home",
      "EVE Kill v4 - The Ultimate Killmail Tracker",
      "Track EVE Online killmails, losses, and statistics with EVE Kill v4. Real-time killmail tracking and comprehensive pilot statistics.",
      data
    );
  }
}
