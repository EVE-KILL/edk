import { database } from '../server/helpers/database'
import { enqueueJobMany, QueueType } from '../server/helpers/queue'
import chalk from 'chalk'
import { logger } from '../server/helpers/logger'

interface KillmailData {
  killmail_id: number
  killmail_hash: string
  killmail_time: string
  solar_system_id: number
  victim: {
    character_id?: number
    corporation_id: number
    alliance_id?: number
    faction_id?: number
    damage_taken: number
    ship_type_id: number
    position?: {
      x: number
      y: number
      z: number
    }
  }
  attackers: Attacker[]
  items: Item[]
  total_value?: number
}

interface Attacker {
  character_id?: number
  corporation_id?: number
  alliance_id?: number
  faction_id?: number
  damage_done: number
  final_blow: boolean
  security_status?: number
  ship_type_id?: number
  weapon_type_id?: number
}

interface Item {
  item_type_id: number
  quantity_dropped?: number
  quantity_destroyed?: number
  flag: number
  singleton: number
}

/**
 * EVE-KILL WebSocket Listener Command
 *
 * Connects to EVE-KILL's WebSocket stream for real-time killmails.
 * When a killmail is received:
 * 1. Check if it already exists in database
 * 2. If new, fetch complete ESI data from EVE-KILL API
 * 3. Parse and store into ClickHouse
 *
 * Usage:
 *   bun cli ekws
 */
export default {
  description: 'Listen to EVE-KILL WebSocket for real-time killmails',

  options: [
    {
      flags: '--filter <entities>',
      description: 'Filter by entity IDs (format: character:123,corporation:456)'
    }
  ],

  action: async (options: any) => {
    const listener = new EkwsListener()
    await listener.execute(options)
  }
}

class EkwsListener {
  private readonly WS_URL = 'wss://ws.eve-kill.com/killmails'
  private readonly ESI_API_BASE = 'https://esi.evetech.net/latest/killmails'
  private running = false
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 10
  private readonly RECONNECT_DELAY = 5000 // 5 seconds

  private stats = {
    received: 0,
    new: 0,
    duplicate: 0,
    processed: 0,
    pings: 0,
    errors: 0
  }

  private followedEntities: Map<string, Set<number>> = new Map()
  private filteringEnabled = false

  constructor() {
    // Initialize entity filters
    this.followedEntities.set('character', new Set())
    this.followedEntities.set('corporation', new Set())
    this.followedEntities.set('alliance', new Set())
  }

  async execute(options: any): Promise<void> {
    // Parse filter if provided
    if (options.filter) {
      this.parseFilter(options.filter)
    }

    this.log(chalk.blue.bold('🚀 Starting EVE-KILL WebSocket listener'))
    this.log(`📡 WebSocket URL: ${chalk.cyan(this.WS_URL)}`)

    if (this.filteringEnabled) {
      this.log(chalk.yellow('🔍 Filtering enabled for followed entities:'))
      for (const [type, ids] of this.followedEntities) {
        if (ids.size > 0) {
          this.log(`   ${type}s: ${chalk.green(Array.from(ids).join(', '))}`)
        }
      }
    } else {
      this.log(chalk.cyan('📡 No filtering - importing all killmails'))
    }

    this.log(chalk.dim('Press Ctrl+C to stop'))

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())

    this.running = true
    await this.connect()
  }

  /**
   * Parse filter string
   */
  private parseFilter(filterStr: string): void {
    const parts = filterStr.split(',')
    for (const part of parts) {
      const [type, id] = part.split(':')
      if (type && id) {
        const numId = Number.parseInt(id)
        if (!Number.isNaN(numId)) {
          if (this.followedEntities.has(type)) {
            this.followedEntities.get(type)!.add(numId)
            this.filteringEnabled = true
          }
        }
      }
    }
  }

  /**
   * Connect to WebSocket with automatic reconnection
   */
  private async connect(): Promise<void> {
    while (this.running) {
      try {
        await this.connectWebSocket()
      } catch (error) {
        this.stats.errors++
        this.error(`WebSocket error: ${error}`)

        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++
          this.log(
            chalk.yellow(`🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`)
          )
          await this.sleep(this.RECONNECT_DELAY)
        } else {
          this.error('Max reconnection attempts reached. Giving up.')
          this.running = false
          break
        }
      }
    }
  }

  /**
   * Establish WebSocket connection and listen for messages
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.WS_URL)

        this.ws.onopen = () => {
          this.success('Connected to EVE-KILL WebSocket')
          this.reconnectAttempts = 0

          // Send subscription message
          this.ws!.send('all')
          this.log(chalk.cyan('📡 Subscribed to "all" killmails'))
        }

        this.ws.onmessage = (event) => {
          try {
            this.handleMessage(event.data)
          } catch (error) {
            this.error(`Error handling message: ${error}`)
            this.stats.errors++
          }
        }

        this.ws.onerror = (event) => {
          this.error(`WebSocket error: ${event}`)
          reject(new Error('WebSocket error'))
        }

        this.ws.onclose = () => {
          this.log(chalk.gray('🔌 WebSocket disconnected'))
          resolve()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      switch (message.type) {
        case 'info':
          this.log(chalk.blue(`ℹ️  ${message.message}`))
          if (message.data?.validTopics && Array.isArray(message.data.validTopics)) {
            this.log(`   Valid topics: ${chalk.cyan(message.data.validTopics.join(', '))}`)
          }
          break

        case 'subscribed':
          this.success(`Subscribed to topics: ${chalk.green(message.data?.topics?.join(', '))}`)
          break

        case 'ping':
          this.stats.pings++
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'pong' }))
          }
          break

        case 'killmail':
          this.processKillmailNotification(message.data)
          this.printStats()
          break

        default:
          this.log(`Unknown message type: ${chalk.yellow(message.type)}`)
      }
    } catch (error) {
      this.error(`Failed to parse message: ${error}`)
      this.error(`Raw data: ${data.substring(0, 200)}...`)
    }
  }

  /**
   * Process a killmail notification from WebSocket
   */
  private async processKillmailNotification(data: any): Promise<void> {
    const killmail = data?.killmail

    if (!killmail) {
      this.error(`⚠️  Invalid killmail data (no killmail object)`)
      return
    }

    const killmailId = killmail.killmail_id
    const hash = killmail.killmail_hash

    if (!killmailId || !hash) {
      this.error(
        `⚠️  Invalid killmail (missing ID or hash): ${JSON.stringify(killmail).substring(0, 100)}...`
      )
      return
    }

    // Filter killmail if filtering is enabled
    if (this.filteringEnabled && !this.isRelevantKillmail(killmail)) {
      return
    }

    // Check if killmail already exists
    try {
      const existing = await database.queryOne(
        'SELECT 1 FROM edk.killmails WHERE killmailId = {id:UInt32}',
        { id: killmailId }
      )

      if (existing) {
        this.stats.duplicate++
        return
      }
    } catch (error) {
      this.error(`Failed to check if killmail exists: ${error}`)
      this.stats.errors++
      return
    }

    this.stats.received++
    this.stats.new++

    // Fetch complete killmail data
    await this.fetchAndProcessKillmail(killmailId, hash)
  }

  /**
   * Fetch complete killmail from ESI API and process it
   */
  private async fetchAndProcessKillmail(killmailId: number, hash: string): Promise<void> {
    try {
      const url = `${this.ESI_API_BASE}/${killmailId}/${hash}`

      const response = await fetch(url)
      if (!response.ok) {
        this.error(`Failed to fetch killmail ${killmailId}: ${response.statusText}`)
        this.stats.errors++
        return
      }

      const esiData = (await response.json()) as any

      // Log first killmail to see structure
      if (this.stats.processed === 0) {
        this.log(`📋 Sample ESI response keys: ${Object.keys(esiData).join(', ')}`)
      }

      // Validate data
      if (!esiData.killmail_id || !esiData.victim || !esiData.attackers) {
        this.error(`Invalid killmail data for ${killmailId}`)
        this.error(`Response keys: ${Object.keys(esiData).join(', ')}`)
        this.stats.errors++
        return
      }

      // ESI might not include items in the response, handle gracefully
      // Note: Items are nested under victim in the ESI response
      if (!esiData.victim?.items) {
        esiData.items = []
      } else {
        esiData.items = esiData.victim.items
      }

      // Process and store the killmail
      await this.storeKillmail(esiData)
      this.stats.processed++

      this.success(
        `Fetched killmail ${killmailId} from ${url}`
      )
    } catch (error) {
      this.error(`Failed to fetch and process killmail ${killmailId}: ${error}`)
      this.stats.errors++
    }
  }

  /**
   * Store killmail and related data into ClickHouse
   */
  private async storeKillmail(esiData: KillmailData): Promise<void> {
    try {
      // Prepare victim data
      const victim = esiData.victim
      const killmailTime = new Date(esiData.killmail_time)
      const killmailTimeUnix = Math.floor(killmailTime.getTime() / 1000)
      const nowUnix = Math.floor(Date.now() / 1000)

      // Insert main killmail record
      const killmailRecord = {
        killmailId: esiData.killmail_id,
        killmailTime: killmailTimeUnix,
        solarSystemId: esiData.solar_system_id,

        // Victim information
        victimAllianceId: victim.alliance_id || null,
        victimCharacterId: victim.character_id || null,
        victimCorporationId: victim.corporation_id,
        victimDamageTaken: victim.damage_taken,
        victimShipTypeId: victim.ship_type_id,

        // Victim position
        positionX: victim.position?.x || null,
        positionY: victim.position?.y || null,
        positionZ: victim.position?.z || null,

        createdAt: nowUnix
      }

      // Insert killmail
      await database.insert('edk.killmails', killmailRecord)

      // Insert attackers
      const attackerRecords = esiData.attackers.map((attacker) => ({
        killmailId: esiData.killmail_id,
        allianceId: attacker.alliance_id || null,
        corporationId: attacker.corporation_id || null,
        characterId: attacker.character_id || null,
        damageDone: attacker.damage_done,
        finalBlow: attacker.final_blow ? 1 : 0,
        securityStatus: attacker.security_status || null,
        shipTypeId: attacker.ship_type_id || null,
        weaponTypeId: attacker.weapon_type_id || null,
        createdAt: nowUnix
      }))

      if (attackerRecords.length > 0) {
        await database.bulkInsert('edk.attackers', attackerRecords)
      }

      // Insert items
      const itemRecords = esiData.items.map((item) => ({
        killmailId: esiData.killmail_id,
        flag: item.flag,
        itemTypeId: item.item_type_id,
        quantityDropped: item.quantity_dropped || 0,
        quantityDestroyed: item.quantity_destroyed || 0,
        singleton: item.singleton,
        createdAt: nowUnix
      }))

      if (itemRecords.length > 0) {
        await database.bulkInsert('edk.items', itemRecords)
      }

      // Enqueue entity update jobs for character, corporation, and alliance data
      // This happens in the background after killmail is stored
      try {
        const characterIds: number[] = []
        const corporationIds: number[] = []
        const allianceIds: number[] = []

        // Collect victim IDs
        if (victim.character_id) {
          characterIds.push(victim.character_id)
        }
        if (victim.corporation_id) {
          corporationIds.push(victim.corporation_id)
        }
        if (victim.alliance_id) {
          allianceIds.push(victim.alliance_id)
        }

        // Collect attacker IDs
        for (const attacker of esiData.attackers) {
          if (attacker.character_id) {
            characterIds.push(attacker.character_id)
          }
          if (attacker.corporation_id) {
            corporationIds.push(attacker.corporation_id)
          }
          if (attacker.alliance_id) {
            allianceIds.push(attacker.alliance_id)
          }
        }

        // Remove duplicates
        const uniqueCharacterIds = [...new Set(characterIds)]
        const uniqueCorporationIds = [...new Set(corporationIds)]
        const uniqueAllianceIds = [...new Set(allianceIds)]

        // Enqueue jobs
        if (uniqueCharacterIds.length > 0) {
          await enqueueJobMany(
            QueueType.CHARACTER,
            uniqueCharacterIds.map((id) => ({ id }))
          )
        }

        if (uniqueCorporationIds.length > 0) {
          await enqueueJobMany(
            QueueType.CORPORATION,
            uniqueCorporationIds.map((id) => ({ id }))
          )
        }

        if (uniqueAllianceIds.length > 0) {
          await enqueueJobMany(
            QueueType.ALLIANCE,
            uniqueAllianceIds.map((id) => ({ id }))
          )
        }
      } catch (error) {
        // Log but don't fail killmail processing if queue enqueuing fails
        this.error(`Failed to enqueue entity update jobs: ${error}`)
      }
    } catch (error) {
      this.error(`Failed to store killmail: ${error}`)
      throw error
    }
  }

  /**
   * Check if a killmail involves any followed entities
   */
  private isRelevantKillmail(killmail: any): boolean {
    const victim = killmail.victim

    // Check victim
    if (victim) {
      if (
        this.followedEntities.get('character')?.has(victim.character_id) ||
        this.followedEntities.get('corporation')?.has(victim.corporation_id) ||
        (victim.alliance_id &&
          this.followedEntities.get('alliance')?.has(victim.alliance_id))
      ) {
        return true
      }
    }

    // Check attackers
    const attackers = killmail.attackers || []
    for (const attacker of attackers) {
      if (
        this.followedEntities.get('character')?.has(attacker.character_id) ||
        this.followedEntities.get('corporation')?.has(attacker.corporation_id) ||
        (attacker.alliance_id &&
          this.followedEntities.get('alliance')?.has(attacker.alliance_id))
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Print statistics
   */
  private printStats(): void {
    if (this.stats.received % 25 === 0) {
      this.log('')
      logger.info('Stats (every 25 killmails):', {
        received: this.stats.received,
        new: this.stats.new,
        duplicate: this.stats.duplicate,
        processed: this.stats.processed,
        pings: this.stats.pings,
        errors: this.stats.errors
      })
      this.log('')
    }
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    this.log('')
    logger.warn('Shutting down EVE-KILL WebSocket listener...')
    this.running = false

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close()
    }

    // Print final stats
    this.log('')
    logger.info('Final Stats:', {
      received: this.stats.received,
      new: this.stats.new,
      duplicate: this.stats.duplicate,
      processed: this.stats.processed,
      pings: this.stats.pings,
      errors: this.stats.errors
    })

    process.exit(0)
  }

  /**
   * Utility methods
   */
  private log(message: string): void {
    console.log(message)
  }

  private error(message: string): void {
    logger.error(message)
  }

  private success(message: string): void {
    logger.success(message)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
