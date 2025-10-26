/**
 * Unified top box data structure
 * Used across all pages and entities
 */

export interface TopBoxItem {
  id: number
  name: string
  kills: number
  imageType: 'ship' | 'character' | 'corporation' | 'alliance' | 'system' | 'region' | 'type'
}

export interface TopBoxStats {
  ships?: TopBoxItem[]
  characters?: TopBoxItem[]
  corporations?: TopBoxItem[]
  alliances?: TopBoxItem[]
  systems?: TopBoxItem[]
  regions?: TopBoxItem[]
}

/**
 * Transform TopBoxStats into format expected by partials
 */
export function formatTopBoxes(stats: TopBoxStats): {
  ships?: Array<TopBoxItem & { link: string }>
  characters?: Array<TopBoxItem & { link: string }>
  corporations?: Array<TopBoxItem & { link: string }>
  alliances?: Array<TopBoxItem & { link: string }>
  systems?: Array<TopBoxItem & { link: string }>
  regions?: Array<TopBoxItem & { link: string }>
} {
  const typeToUrlMap: Record<TopBoxItem['imageType'], string> = {
    ship: '/type',
    type: '/type',
    character: '/character',
    corporation: '/corporation',
    alliance: '/alliance',
    system: '/system',
    region: '/region'
  }

  const formatted: any = {}

  for (const [key, items] of Object.entries(stats)) {
    if (Array.isArray(items) && items.length > 0) {
      const baseUrl = typeToUrlMap[items[0].imageType]
      formatted[key] = items.map((item: TopBoxItem) => ({
        ...item,
        link: `${baseUrl}/${item.id}`
      }))
    }
  }

  return formatted
}
