import { logger } from '../server/helpers/logger'
import { database } from '../server/helpers/database'
import { enqueueJobMany } from '../server/helpers/queue'
import { QueueType } from '../server/helpers/queue'
import { storeKillmailsBulk } from '../server/models/killmails'
import type { ESIKillmail } from '../server/models/killmails'

export default {
  description: 'Backfill killmails from eve-kill.com API for followed entities',
  options: [
    {
      flags: '--limit <number>',
      description: 'Maximum number of killmails to fetch (default: unlimited)',
    },
    {
      flags: '--fetch <size>',
      description: 'Number of killmails per API request (default: 1000)',
      defaultValue: '1000',
    },
    {
      flags: '--delay <ms>',
      description: 'Delay between API fetches in milliseconds (default: 1000)',
      defaultValue: '1000',
    },
    {
      flags: '--page <number>',
      description: 'Starting page number to resume from (default: 0)',
      defaultValue: '0',
    },
  ],
  action: async (options: {
    limit?: string
    fetch?: string
    delay?: string
    page?: string
  }) => {
    const maxLimit = options.limit ? Number.parseInt(options.limit) : Number.POSITIVE_INFINITY
    const fetchSize = options.fetch ? Number.parseInt(options.fetch) : 1000
    const delayMs = options.delay ? Number.parseInt(options.delay) : 1000
    const startPage = options.page ? Number.parseInt(options.page) : 0

    // Get followed entities from environment variables
    const followedCharacterIds = process.env.FOLLOWED_CHARACTER_IDS
      ?.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .map(id => Number.parseInt(id))
      .filter(id => !Number.isNaN(id)) || []

    const followedCorporationIds = process.env.FOLLOWED_CORPORATION_IDS
      ?.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .map(id => Number.parseInt(id))
      .filter(id => !Number.isNaN(id)) || []

    const followedAllianceIds = process.env.FOLLOWED_ALLIANCE_IDS
      ?.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .map(id => Number.parseInt(id))
      .filter(id => !Number.isNaN(id)) || []

    if (
      followedCharacterIds.length === 0 &&
      followedCorporationIds.length === 0 &&
      followedAllianceIds.length === 0
    ) {
      logger.error('No followed entities configured in .env (FOLLOWED_CHARACTER_IDS, FOLLOWED_CORPORATION_IDS, FOLLOWED_ALLIANCE_IDS)')
      process.exit(1)
    }

    logger.info('Starting backfill for followed entities', {
      maxLimit,
      characters: followedCharacterIds.length,
      corporations: followedCorporationIds.length,
      alliances: followedAllianceIds.length,
      fetchSize,
      delayMs,
      startPage,
    })

    let processed = 0
    let successful = 0
    let failed = 0
    let skipped = 0
    let skip = startPage * fetchSize
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 5

    const startTime = Date.now()

    logger.info('Fetching killmails from eve-kill.com API')

    // Fetch killmail IDs for followed entities using export API
    while (processed < maxLimit) {
      const killmails = await fetchKillmailsForEntities(
        followedCharacterIds,
        followedCorporationIds,
        followedAllianceIds,
        fetchSize,
        skip
      )

      if (killmails.length === 0) {
        consecutiveErrors++
        logger.warn(`No killmails fetched (attempt ${consecutiveErrors}/${maxConsecutiveErrors})`)

        // If we hit too many consecutive errors, stop
        if (consecutiveErrors >= maxConsecutiveErrors) {
          logger.info('Reached maximum consecutive errors, stopping backfill')
          break
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      // Reset error counter on successful fetch
      consecutiveErrors = 0

      logger.info(`Fetched ${killmails.length} killmails, processing...`)

      // Collect all entities from all killmails first
      const allCharacters = new Map<number, { id: number; name: string; corporationId: number; allianceId: number }>()
      const allCorporations = new Map<number, { id: number; name: string; allianceId: number }>()
      const allAlliances = new Map<number, { id: number; name: string }>()

      // Extract entities from all killmails
      for (const killmail of killmails) {
        // Victim entities
        if (killmail.victim.character_id > 0) {
          allCharacters.set(killmail.victim.character_id, {
            id: killmail.victim.character_id,
            name: killmail.victim.character_name,
            corporationId: killmail.victim.corporation_id,
            allianceId: killmail.victim.alliance_id,
          })
        }
        if (killmail.victim.corporation_id > 0) {
          allCorporations.set(killmail.victim.corporation_id, {
            id: killmail.victim.corporation_id,
            name: killmail.victim.corporation_name,
            allianceId: killmail.victim.alliance_id,
          })
        }
        if (killmail.victim.alliance_id > 0) {
          allAlliances.set(killmail.victim.alliance_id, {
            id: killmail.victim.alliance_id,
            name: killmail.victim.alliance_name,
          })
        }

        // Attacker entities
        for (const attacker of killmail.attackers || []) {
          if (attacker.character_id > 0) {
            allCharacters.set(attacker.character_id, {
              id: attacker.character_id,
              name: attacker.character_name,
              corporationId: attacker.corporation_id,
              allianceId: attacker.alliance_id,
            })
          }
          if (attacker.corporation_id > 0) {
            allCorporations.set(attacker.corporation_id, {
              id: attacker.corporation_id,
              name: attacker.corporation_name,
              allianceId: attacker.alliance_id,
            })
          }
          if (attacker.alliance_id > 0) {
            allAlliances.set(attacker.alliance_id, {
              id: attacker.alliance_id,
              name: attacker.alliance_name,
            })
          }
        }
      }

            // Store all entities in bulk (once per fetch batch)
      await storeEntitiesInBulk(allCharacters, allCorporations, allAlliances)

      // Check which killmails already exist (batch query)
      const killmailIds = killmails.map(k => k.killmail_id)
      const existingIds = await database.query<{ killmailId: number }>(
        'SELECT killmailId FROM killmails WHERE killmailId IN ({ids:Array(UInt32)})',
        { ids: killmailIds }
      )
      const existingIdsSet = new Set(existingIds.map(row => row.killmailId))

      // Filter out existing killmails
      const newKillmails = killmails.filter(k => !existingIdsSet.has(k.killmail_id))
      skipped += existingIdsSet.size

      logger.info(`Found ${newKillmails.length} new killmails to store (${existingIdsSet.size} already exist)`)

      // Convert all new killmails to ESI format
      const esiKillmails = newKillmails.map((killmail, index) => ({
        esi: convertEveKillToESI(killmail),
        hash: killmails[index]?.killmail_hash,
        original: killmail
      }))

      // Store all killmails in bulk
      if (esiKillmails.length > 0) {
        try {
          await storeKillmailsBulk(esiKillmails.map(k => ({ esi: k.esi, hash: k.hash })))
          successful += esiKillmails.length
          logger.info(`Stored ${esiKillmails.length} killmails in bulk`)

          // Extract and store price data from killmails
          await storePriceDataFromKillmails(newKillmails)

          // Enqueue background jobs to fetch full details (in parallel)
          await Promise.allSettled(
            esiKillmails.map(({ original }) => enqueueEntityUpdates(original))
          )
        } catch (error) {
          logger.error('Failed to store killmails in bulk', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          failed += esiKillmails.length
        }
      }

      processed += killmails.length

      const elapsedSeconds = (Date.now() - startTime) / 1000
      const rate = processed / elapsedSeconds
      const currentPage = Math.floor(skip / fetchSize)

      logger.info('Batch complete', {
        page: currentPage,
        processed,
        successful,
        failed,
        skipped,
        rate: `${rate.toFixed(2)}/s`,
      })

      // If we got fewer results than requested, we're done
      if (killmails.length < fetchSize) {
        logger.info('Received fewer killmails than requested, all data fetched')
        break
      }

      // Check if we've hit the limit
      if (processed >= maxLimit) {
        logger.info('Reached maximum limit')
        break
      }

      // Wait before next fetch
      await new Promise(resolve => setTimeout(resolve, delayMs))

      // Move to next page
      skip += fetchSize
    }

    const totalTime = (Date.now() - startTime) / 1000
    logger.success('Backfill complete', {
      processed,
      successful,
      failed,
      skipped,
      totalTime: `${totalTime.toFixed(2)}s`,
      avgRate: `${(processed / totalTime).toFixed(2)}/s`,
    })
  },
}

// Types for eve-kill.com API response
interface EveKillAPIKillmail {
  killmail_id: number
  killmail_hash: string
  kill_time: string
  system_id: number
  system_name: string | { en: string }
  system_security: number
  constellation_id: number
  constellation_name: string | { en: string }
  region_id: number
  region_name: string | { en: string }
  victim: {
    ship_id: number
    ship_name: string | { en: string }
    ship_group_id: number
    damage_taken: number
    character_id: number
    character_name: string
    corporation_id: number
    corporation_name: string
    alliance_id: number
    alliance_name: string
    faction_id: number
    faction_name: string
  }
  attackers: Array<{
    ship_id: number
    ship_name: string | { en: string }
    ship_group_id: number
    character_id: number
    character_name: string
    corporation_id: number
    corporation_name: string
    alliance_id: number
    alliance_name: string
    faction_id: number
    faction_name: string
    security_status: number
    damage_done: number
    final_blow: boolean
    weapon_type_id: number
  }>
  items: Array<{
    type_id: number
    flag: number
    qty_dropped: number
    qty_destroyed: number
    singleton: number
    value: number
  }>
  ship_value: number
  fitting_value: number
  total_value: number
}

// Store entities from eve-kill killmail with basic info
async function storeEntitiesInBulk(
  characters: Map<number, { id: number; name: string; corporationId: number; allianceId: number }>,
  corporations: Map<number, { id: number; name: string; allianceId: number }>,
  alliances: Map<number, { id: number; name: string }>
): Promise<void> {
  const currentVersion = Date.now()
  const unixTimestamp = Math.floor(Date.now() / 1000)

  // Store characters with basic info
  if (characters.size > 0) {
    const characterData = Array.from(characters.values()).map(char => ({
      character_id: char.id,
      alliance_id: char.allianceId > 0 ? char.allianceId : null,
      birthday: '', // Unknown, will be filled by queue worker
      bloodline_id: 0, // Unknown, will be filled by queue worker
      corporation_id: char.corporationId,
      description: '', // Unknown, will be filled by queue worker
      gender: '', // Unknown, will be filled by queue worker
      name: char.name,
      race_id: 0, // Unknown, will be filled by queue worker
      security_status: 0, // Unknown, will be filled by queue worker
      updated_at: unixTimestamp,
      version: currentVersion,
    }))
    await database.bulkInsert('characters', characterData)
    logger.info(`Stored ${characterData.length} characters`)
  }

  // Store corporations with basic info
  if (corporations.size > 0) {
    const corporationData = Array.from(corporations.values()).map(corp => ({
      corporation_id: corp.id,
      alliance_id: corp.allianceId > 0 ? corp.allianceId : null,
      ceo_id: 0, // Unknown, will be filled by queue worker
      creator_id: 0, // Unknown, will be filled by queue worker
      date_founded: '', // Unknown, will be filled by queue worker
      description: '', // Unknown, will be filled by queue worker
      home_station_id: null, // Unknown, will be filled by queue worker
      member_count: 0, // Unknown, will be filled by queue worker
      name: corp.name,
      shares: 0, // Unknown, will be filled by queue worker
      tax_rate: 0, // Unknown, will be filled by queue worker
      ticker: '', // Unknown, will be filled by queue worker
      url: '', // Unknown, will be filled by queue worker
      updated_at: unixTimestamp,
      version: currentVersion,
    }))
    await database.bulkInsert('corporations', corporationData)
    logger.info(`Stored ${corporationData.length} corporations`)
  }

  // Store alliances with basic info
  if (alliances.size > 0) {
    const allianceData = Array.from(alliances.values()).map(alliance => ({
      alliance_id: alliance.id,
      creator_corporation_id: 0, // Unknown, will be filled by queue worker
      creator_id: 0, // Unknown, will be filled by queue worker
      date_founded: '', // Unknown, will be filled by queue worker
      executor_corporation_id: 0, // Unknown, will be filled by queue worker
      name: alliance.name,
      ticker: '', // Unknown, will be filled by queue worker
      updated_at: unixTimestamp,
      version: currentVersion,
    }))
    await database.bulkInsert('alliances', allianceData)
    logger.info(`Stored ${allianceData.length} alliances`)
  }
}

// Extract and store price data from killmails
async function storePriceDataFromKillmails(killmails: EveKillAPIKillmail[]): Promise<void> {
  const priceMap = new Map<string, {
    type_id: number
    price_date: string
    average_price: number
  }>()

  for (const killmail of killmails) {
    // Get the date from the killmail (YYYY-MM-DD format)
    const killDate = killmail.kill_time.split('T')[0]

    // Add ship price if it has value
    if (killmail.ship_value > 0) {
      const key = `${killmail.victim.ship_id}_${killDate}`
      if (!priceMap.has(key)) {
        priceMap.set(key, {
          type_id: killmail.victim.ship_id,
          price_date: killDate,
          average_price: killmail.ship_value,
        })
      }
    }

    // Add item prices
    for (const item of killmail.items) {
      if (item.value > 0) {
        const key = `${item.type_id}_${killDate}`
        if (!priceMap.has(key)) {
          priceMap.set(key, {
            type_id: item.type_id,
            price_date: killDate,
            average_price: item.value,
          })
        }
      }
    }
  }

  if (priceMap.size > 0) {
    const currentVersion = Date.now()
    const unixTimestamp = Math.floor(Date.now() / 1000)

    const priceData = Array.from(priceMap.values()).map(price => ({
      type_id: price.type_id,
      region_id: 10000002, // The Forge (Jita) - standard pricing region
      price_date: price.price_date,
      average_price: price.average_price,
      highest_price: price.average_price, // We don't have these from eve-kill, use average
      lowest_price: price.average_price,
      order_count: 0, // Unknown
      volume: 0, // Unknown
      updated_at: unixTimestamp,
      version: currentVersion,
    }))

    await database.bulkInsert('prices', priceData)
    logger.info(`Stored ${priceData.length} price records`)
  }
}

// Convert eve-kill format to ESI format
function convertEveKillToESI(killmail: EveKillAPIKillmail): ESIKillmail {
  // Convert kill_time to ISO format without milliseconds
  const killTime = new Date(killmail.kill_time).toISOString().replace(/\.\d{3}Z$/, 'Z')

  return {
    killmail_id: killmail.killmail_id,
    killmail_time: killTime,
    solar_system_id: killmail.system_id,
    victim: {
      ship_type_id: killmail.victim.ship_id,
      character_id: killmail.victim.character_id > 0 ? killmail.victim.character_id : undefined,
      corporation_id: killmail.victim.corporation_id,
      alliance_id: killmail.victim.alliance_id > 0 ? killmail.victim.alliance_id : undefined,
      damage_taken: killmail.victim.damage_taken,
      position: undefined, // Not available in eve-kill API
      items: killmail.items.map((item) => ({
        item_type_id: item.type_id,
        flag: item.flag,
        quantity_dropped: item.qty_dropped > 0 ? item.qty_dropped : undefined,
        quantity_destroyed: item.qty_destroyed > 0 ? item.qty_destroyed : undefined,
        singleton: item.singleton,
      })),
    },
    attackers: killmail.attackers.map((attacker) => ({
      ship_type_id: attacker.ship_id > 0 ? attacker.ship_id : undefined,
      character_id: attacker.character_id > 0 ? attacker.character_id : undefined,
      corporation_id: attacker.corporation_id > 0 ? attacker.corporation_id : undefined,
      alliance_id: attacker.alliance_id > 0 ? attacker.alliance_id : undefined,
      security_status: attacker.security_status,
      damage_done: attacker.damage_done,
      final_blow: attacker.final_blow,
      weapon_type_id: attacker.weapon_type_id > 0 ? attacker.weapon_type_id : undefined,
    })),
  }
}

// Enqueue background jobs to fetch full entity details
async function enqueueEntityUpdates(
  killmail: EveKillAPIKillmail
): Promise<void> {
  const characterIds = new Set<number>()
  const corporationIds = new Set<number>()
  const allianceIds = new Set<number>()

  // Victim
  if (killmail.victim.character_id > 0) {
    characterIds.add(killmail.victim.character_id)
  }
  if (killmail.victim.corporation_id > 0) {
    corporationIds.add(killmail.victim.corporation_id)
  }
  if (killmail.victim.alliance_id > 0) {
    allianceIds.add(killmail.victim.alliance_id)
  }

  // Attackers
  for (const attacker of killmail.attackers) {
    if (attacker.character_id > 0) {
      characterIds.add(attacker.character_id)
    }
    if (attacker.corporation_id > 0) {
      corporationIds.add(attacker.corporation_id)
    }
    if (attacker.alliance_id > 0) {
      allianceIds.add(attacker.alliance_id)
    }
  }

  // Enqueue jobs
  if (characterIds.size > 0) {
    await enqueueJobMany(
      QueueType.CHARACTER,
      Array.from(characterIds).map((id) => ({ id }))
    )
  }
  if (corporationIds.size > 0) {
    await enqueueJobMany(
      QueueType.CORPORATION,
      Array.from(corporationIds).map((id) => ({ id }))
    )
  }
  if (allianceIds.size > 0) {
    await enqueueJobMany(
      QueueType.ALLIANCE,
      Array.from(allianceIds).map((id) => ({ id }))
    )
  }
}

// Fetch killmails for followed entities from eve-kill.com export API
async function fetchKillmailsForEntities(
  characterIds: number[],
  corporationIds: number[],
  allianceIds: number[],
  limit: number,
  skip: number
): Promise<EveKillAPIKillmail[]> {
  try {
    const filter: any = {}

    if (characterIds.length > 0) {
      filter.character_ids = characterIds
    }
    if (corporationIds.length > 0) {
      filter.corporation_ids = corporationIds
    }
    if (allianceIds.length > 0) {
      filter.alliance_ids = allianceIds
    }

    const requestBody = {
      filter,
      options: {
        limit,
        skip,
      },
    }

    const page = Math.floor(skip / limit)
    logger.debug(`Fetching killmails (page: ${page}, skip: ${skip}, limit: ${limit})`)

    const response = await fetch('https://eve-kill.com/api/export/killmails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EVE-Kill EDK/1.0 (https://github.com/EVE-KILL/edk)',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      logger.warn(`Eve-Kill API returned HTTP ${response.status}: ${response.statusText}. Returning empty array to allow resume.`)
      return []
    }

    const result: any = await response.json()

    if (!result.data || !Array.isArray(result.data)) {
      logger.warn(`Eve-Kill API returned unexpected format. Returning empty array to allow resume.`)
      return []
    }

    return result.data
  } catch (error) {
    logger.warn('Failed to fetch killmails from eve-kill.com', {
      error: error instanceof Error ? error.message : String(error),
      hint: 'Connection error. Will retry after delay to allow resume.'
    })
    return []
  }
}
