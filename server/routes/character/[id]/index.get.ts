/**
 * Character entity page - dashboard
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getCharacterWithCorporationAndAlliance } from '../../../models/characters';
import {
  getEntityKillmails,
  countEntityKillmails,
} from '../../../models/killlist';
import { getEntityStats } from '../../../models/entityStats';
import { getMostValuableKillsByCharacter } from '../../../models/mostValuableKills';
import { getTopByKills } from '../../../models/topBoxes';

export default defineEventHandler(async (event: H3Event) => {
  const characterId = Number.parseInt(getRouterParam(event, 'id') || '0');

  if (!characterId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid character ID',
    });
  }

  // Fetch character basic info using model
  const characterData =
    await getCharacterWithCorporationAndAlliance(characterId);

  if (!characterData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Character not found',
    });
  }

  // Fetch all entity data in parallel
  const [
    stats,
    topShips,
    topSystems,
    topRegions,
    topCorps,
    topAlliances,
    mostValuable,
  ] = await Promise.all([
    getEntityStats(characterId, 'character', 'all'),
    getTopByKills('week', 'ship', 10),
    getTopByKills('week', 'system', 10),
    getTopByKills('week', 'region', 10),
    getTopByKills('week', 'corporation', 10),
    getTopByKills('week', 'alliance', 10),
    getMostValuableKillsByCharacter(characterId, 'all', 6),
  ]);

  // Get pagination parameters
  const query = getQuery(event);
  const page = Math.max(1, Number.parseInt(query.page as string) || 1);
  const perPage = 30;

  // Fetch paginated killmails using model function
  const [killmails, totalKillmails] = await Promise.all([
    getEntityKillmails(characterId, 'character', 'all', page, perPage),
    countEntityKillmails(characterId, 'character', 'all'),
  ]);

  const totalPages = Math.ceil(totalKillmails / perPage);

  // Format killmail data for template
  const recentKillmails = killmails.map((km) => {
    const normalized = normalizeKillRow(km);
    return {
      ...normalized,
      isLoss: km.victimCharacterId === characterId,
      killmailTimeRelative: timeAgo(
        new Date(km.killmailTime ?? normalized.killmailTime)
      ),
    };
  });

  // Entity header data
  const entityData = {
    entityId: characterId,
    entityType: 'character',
    name: characterData.name,
    type: 'character',
    stats,
    baseUrl: `/character/${characterId}`,
    entityBaseUrl: `/character/${characterId}`,
    currentTab: 'dashboard',
    parent: characterData.corporationId
      ? {
          id: characterData.corporationId,
          name: characterData.corporationName,
          ticker: characterData.corporationTicker,
        }
      : null,
    grandparent: characterData.allianceId
      ? {
          id: characterData.allianceId,
          name: characterData.allianceName,
          ticker: characterData.allianceTicker,
        }
      : null,
  };

  // Top 10 boxes - transform to match partial expectations
  const top10 = {
    ships: (topShips as any[]).map((s: any) => ({
      ...s,
      imageType: 'type',
      imageId: s.id,
      link: `/type/${s.id}`,
    })),
    characters: [],
    systems: (topSystems as any[]).map((s: any) => ({
      ...s,
      imageType: 'system',
      imageId: s.id,
      link: `/system/${s.id}`,
    })),
    regions: (topRegions as any[]).map((r: any) => ({
      ...r,
      imageType: 'region',
      imageId: r.id,
      link: `/region/${r.id}`,
    })),
    corporations: (topCorps as any[]).map((c: any) => ({
      ...c,
      imageType: 'corporation',
      imageId: c.id,
      link: `/corporation/${c.id}`,
    })),
    alliances: (topAlliances as any[]).map((a: any) => ({
      ...a,
      imageType: 'alliance',
      imageId: a.id,
      link: `/alliance/${a.id}`,
    })),
  };

  // Pagination
  const pagination = {
    currentPage: page,
    totalPages,
    pages: generatePageNumbers(page, totalPages),
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page - 1,
    nextPage: page + 1,
    showFirst: page > 3 && totalPages > 5,
    showLast: page < totalPages - 2 && totalPages > 5,
  };

  // Transform most valuable kills to template format
  const transformedMostValuable = mostValuable.map((kill) => {
    const normalized = normalizeKillRow(kill);
    return {
      ...normalized,
      totalValue: kill.totalValue ?? normalized.totalValue,
      killmailTime: normalized.killmailTime,
    };
  });

  // Render the template
  return render(
    'pages/character-detail',
    {
      title: `${characterData.name} - Character`,
      description: `Character statistics for ${characterData.name}`,
      keywords: 'eve online, character, killmail, pvp',
    },
    {
      ...entityData,
      top10Stats: top10,
      mostValuableKills: transformedMostValuable,
      recentKillmails,
      pagination,
    }
  );
});

// Helper function to generate page numbers
function generatePageNumbers(
  currentPage: number,
  totalPages: number
): number[] {
  const pages: number[] = [];
  const maxVisible = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}
