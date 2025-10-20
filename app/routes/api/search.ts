import { ApiController } from "../../../src/controllers/api-controller";
import { like, or } from "drizzle-orm";
import { characters } from "../../../db/schema/characters";
import { corporations } from "../../../db/schema/corporations";
import { alliances } from "../../../db/schema/alliances";
import { types } from "../../../db/schema/types";
import { solarSystems } from "../../../db/schema/solar-systems";

interface SearchResult {
  type: "character" | "corporation" | "alliance" | "item" | "system";
  id: number;
  name: string;
  ticker?: string;
  description?: string;
}

export class Controller extends ApiController {
  static methods = ["GET"];

  async get(): Promise<Response> {
    const query = this.url.searchParams.get("q");
    const limit = parseInt(this.url.searchParams.get("limit") || "10");

    // Validate query
    if (!query || query.trim().length < 2) {
      return this.jsonResponse({
        success: false,
        error: "Query must be at least 2 characters",
      }, 400);
    }

    const searchTerm = `%${query.trim()}%`;
    const results: SearchResult[] = [];

    try {
      // Search characters
      const characterResults = await this.db
        .select({
          characterId: characters.characterId,
          name: characters.name,
        })
        .from(characters)
        .where(like(characters.name, searchTerm))
        .limit(limit);

      results.push(
        ...characterResults.map((char) => ({
          type: "character" as const,
          id: char.characterId,
          name: char.name,
        }))
      );

      // Search corporations
      const corporationResults = await this.db
        .select({
          corporationId: corporations.corporationId,
          name: corporations.name,
          ticker: corporations.ticker,
        })
        .from(corporations)
        .where(
          or(
            like(corporations.name, searchTerm),
            like(corporations.ticker, searchTerm)
          )
        )
        .limit(limit);

      results.push(
        ...corporationResults.map((corp) => ({
          type: "corporation" as const,
          id: corp.corporationId,
          name: corp.name,
          ticker: corp.ticker || undefined,
        }))
      );

      // Search alliances
      const allianceResults = await this.db
        .select({
          allianceId: alliances.allianceId,
          name: alliances.name,
          ticker: alliances.ticker,
        })
        .from(alliances)
        .where(
          or(
            like(alliances.name, searchTerm),
            like(alliances.ticker, searchTerm)
          )
        )
        .limit(limit);

      results.push(
        ...allianceResults.map((alliance) => ({
          type: "alliance" as const,
          id: alliance.allianceId,
          name: alliance.name,
          ticker: alliance.ticker,
        }))
      );

      // Search types (items/ships)
      const typeResults = await this.db
        .select({
          typeId: types.typeId,
          name: types.name,
          description: types.description,
        })
        .from(types)
        .where(like(types.name, searchTerm))
        .limit(limit);

      results.push(
        ...typeResults.map((type) => ({
          type: "item" as const,
          id: type.typeId,
          name: type.name,
          description: type.description || undefined,
        }))
      );

      // Search solar systems
      const systemResults = await this.db
        .select({
          systemId: solarSystems.systemId,
          name: solarSystems.name,
          securityStatus: solarSystems.securityStatus,
        })
        .from(solarSystems)
        .where(like(solarSystems.name, searchTerm))
        .limit(limit);

      results.push(
        ...systemResults.map((system) => ({
          type: "system" as const,
          id: system.systemId,
          name: system.name,
          description: `Security: ${system.securityStatus}`,
        }))
      );

      // Sort results by relevance (exact matches first, then starts with, then contains)
      const sortedResults = results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === query.toLowerCase() ? 0 : 1;
        const bExact = b.name.toLowerCase() === query.toLowerCase() ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;

        const aStarts = a.name.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;

        return a.name.localeCompare(b.name);
      });

      // Limit total results
      const limitedResults = sortedResults.slice(0, limit);

      return this.jsonResponse({
        success: true,
        query,
        results: limitedResults,
        total: limitedResults.length,
      });
    } catch (error) {
      console.error("Search error:", error);
      return this.jsonResponse({
        success: false,
        error: "Search failed",
      }, 500);
    }
  }
}
