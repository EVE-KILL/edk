/**
 * Unified top box data structure
 * Used across all pages and entities
 */

export interface TopBoxItemHelper {
  id: number;
  name: string;
  kills: number;
  imageType:
    | 'ship'
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'system'
    | 'region'
    | 'constellation'
    | 'type';
}

export interface TopBoxStatsHelper {
  ships?: TopBoxItemHelper[];
  characters?: TopBoxItemHelper[];
  corporations?: TopBoxItemHelper[];
  alliances?: TopBoxItemHelper[];
  systems?: TopBoxItemHelper[];
  regions?: TopBoxItemHelper[];
}

/**
 * Transform TopBoxStats into format expected by partials
 */
export function formatTopBoxesHelper(stats: TopBoxStatsHelper): {
  ships?: Array<TopBoxItemHelper & { link: string }>;
  characters?: Array<TopBoxItemHelper & { link: string }>;
  corporations?: Array<TopBoxItemHelper & { link: string }>;
  alliances?: Array<TopBoxItemHelper & { link: string }>;
  systems?: Array<TopBoxItemHelper & { link: string }>;
  regions?: Array<TopBoxItemHelper & { link: string }>;
} {
  const typeToUrlMap: Record<TopBoxItemHelper['imageType'], string> = {
    ship: '/type',
    type: '/type',
    character: '/character',
    corporation: '/corporation',
    alliance: '/alliance',
    system: '/system',
    region: '/region',
    constellation: '/constellation',
  };

  const formatted: any = {};

  for (const [key, items] of Object.entries(stats) as Array<
    [string, TopBoxItemHelper[]]
  >) {
    if (Array.isArray(items) && items.length > 0) {
      const baseUrl = typeToUrlMap[items[0].imageType];
      formatted[key] = items.map((item: TopBoxItemHelper) => ({
        ...item,
        link: `${baseUrl}/${item.id}`,
      }));
    }
  }

  return formatted;
}
