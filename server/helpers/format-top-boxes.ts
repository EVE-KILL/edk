/**
 * Formats entity data for the top-10-box partial
 * Converts various entity types into a unified structure
 */

export interface FormattedTopBoxItem {
  name: string
  kills: number
  imageType: string
  imageId: number
  link: string
  dataAttribute?: string
}

export function formatTopBoxes(stats: any): any {
  if (!stats) return {}

  const formatted: any = {}

  if (stats.ships && Array.isArray(stats.ships)) {
    formatted.ships = stats.ships.map((item: any) => ({
      name: item.name,
      kills: item.count || item.kills,
      imageType: 'type',
      imageId: item.id,
      link: `/type/${item.id}`
    }))
  }

  if (stats.characters && Array.isArray(stats.characters)) {
    formatted.characters = stats.characters.map((item: any) => ({
      name: item.name,
      kills: item.kills || item.count,
      imageType: 'character',
      imageId: item.id,
      link: `/character/${item.id}`,
      dataAttribute: 'data-character-id'
    }))
  }

  if (stats.corporations && Array.isArray(stats.corporations)) {
    formatted.corporations = stats.corporations.map((item: any) => ({
      name: item.name,
      kills: item.count || item.kills,
      imageType: 'corporation',
      imageId: item.id,
      link: `/corporation/${item.id}`,
      dataAttribute: 'data-corporation-id'
    }))
  }

  if (stats.alliances && Array.isArray(stats.alliances)) {
    formatted.alliances = stats.alliances.map((item: any) => ({
      name: item.name,
      kills: item.count || item.kills,
      imageType: 'alliance',
      imageId: item.id,
      link: `/alliance/${item.id}`,
      dataAttribute: 'data-alliance-id'
    }))
  }

  if (stats.systems && Array.isArray(stats.systems)) {
    formatted.systems = stats.systems.map((item: any) => ({
      name: item.name,
      kills: item.count || item.kills,
      imageType: 'system',
      imageId: item.id,
      link: `/system/${item.id}`
    }))
  }

  if (stats.regions && Array.isArray(stats.regions)) {
    formatted.regions = stats.regions.map((item: any) => ({
      name: item.name,
      kills: item.count || item.kills,
      imageType: 'region',
      imageId: item.id,
      link: `/region/${item.id}`
    }))
  }

  return formatted
}
