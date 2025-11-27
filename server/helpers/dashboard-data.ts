import {
  getTopVictimsByAttacker,
  getTopAttackersByVictim,
} from '../models/topBoxes';
import {
  getMostValuableKillsByCharacter,
  getMostValuableKillsByCorporation,
  getMostValuableKillsByAlliance,
  getMostValuableLossesByCharacter,
  getMostValuableLossesByCorporation,
  getMostValuableLossesByAlliance,
} from '../models/mostValuableKills';
import { normalizeKillRow } from './templates';
import { track } from '../utils/performance-decorators';

export async function getDashboardData(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  pageType: 'kills' | 'losses' | 'overview',
  filters: any
) {
  const timeRange = filters.timeRange || 'week';

  const [
    topCharacters,
    topCorps,
    topAlliances,
    topShips,
    topSystems,
    topRegions,
    mostValuable,
  ] = await track(
    `${entityType}:${pageType}:fetch_dashboard_data`,
    'application',
    async () => {
      const topPromises =
        pageType === 'losses'
          ? [
              getTopAttackersByVictim(entityId, entityType, timeRange, 'character', 10),
              getTopAttackersByVictim(entityId, entityType, timeRange, 'corporation', 10),
              getTopAttackersByVictim(entityId, entityType, timeRange, 'alliance', 10),
              getTopAttackersByVictim(entityId, entityType, timeRange, 'ship', 10),
              getTopAttackersByVictim(entityId, entityType, timeRange, 'system', 10),
              getTopAttackersByVictim(entityId, entityType, timeRange, 'region', 10),
            ]
          : [
              getTopVictimsByAttacker(entityId, entityType, timeRange, 'character', 10),
              getTopVictimsByAttacker(entityId, entityType, timeRange, 'corporation', 10),
              getTopVictimsByAttacker(entityId, entityType, timeRange, 'alliance', 10),
              getTopVictimsByAttacker(entityId, entityType, timeRange, 'ship', 10),
              getTopVictimsByAttacker(entityId, entityType, timeRange, 'system', 10),
              getTopVictimsByAttacker(entityId, entityType, timeRange, 'region', 10),
            ];

      const mostValuablePromise =
        pageType === 'losses'
          ? entityType === 'character'
            ? getMostValuableLossesByCharacter(entityId, timeRange, 6)
            : entityType === 'corporation'
            ? getMostValuableLossesByCorporation(entityId, timeRange, 6)
            : getMostValuableLossesByAlliance(entityId, timeRange, 6)
          : entityType === 'character'
          ? getMostValuableKillsByCharacter(entityId, timeRange, 6)
          : entityType === 'corporation'
          ? getMostValuableKillsByCorporation(entityId, timeRange, 6)
          : getMostValuableKillsByAlliance(entityId, timeRange, 6);

      return await Promise.all([...topPromises, mostValuablePromise]);
    }
  );

  const top10 = {
    ships: (topShips as any[]).map((s: any) => ({
      ...s,
      imageType: 'type',
      imageId: s.id,
      link: `/type/${s.id}`,
    })),
    characters: (topCharacters as any[]).map((c: any) => ({
      ...c,
      imageType: 'character',
      imageId: c.id,
      link: `/character/${c.id}`,
    })),
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

  const transformedMostValuable = mostValuable.map((kill) => {
    const normalized = normalizeKillRow(kill);
    return {
      ...normalized,
      totalValue: kill.totalValue ?? normalized.totalValue,
      killmailTime: normalized.killmailTime,
    };
  });

  const titles =
    pageType === 'losses'
      ? {
          characterTitle: 'Top Assailants',
          corporationTitle: 'Top Attacking Corps',
          allianceTitle: 'Top Attacking Alliances',
          shipTitle: 'Top Attacking Ships',
          systemTitle: 'Top Systems',
          regionTitle: 'Top Regions',
        }
      : {
          characterTitle: 'Most Hunted Characters',
          corporationTitle: 'Most Hunted Corps',
          allianceTitle: 'Most Hunted Alliances',
          shipTitle: 'Most Hunted Ships',
          systemTitle: 'Top Hunting Grounds',
          regionTitle: 'Top Regions',
        };

  return {
    top10Stats: top10,
    mostValuableKills: transformedMostValuable,
    timeRange: `Last ${
      timeRange === 'week' ? '7 Days' : timeRange === 'month' ? '30 Days' : 'All Time'
    }`,
    ...titles,
  };
}
