import { Peer } from 'crossws'
import { createRedisClient } from '~/helpers/redis'
import { getFilteredKillsWithNames } from '~/models/killlist'
import { normalizeKillRow } from '~/helpers/templates'
import { logger } from '~/helpers/logger'

export interface ClientData {
  topics: string[]
  connectedAt: Date
}

export interface WebSocketMessage {
  type:
    | 'subscribe'
    | 'unsubscribe'
    | 'ping'
    | 'pong'
    | 'info'
    | 'error'
    | 'subscribed'
    | 'unsubscribed'
  message?: string
  topics?: string[]
  data?: any
}

export interface MessageHandler {
  isValidTopic?: (topic: string) => boolean
  shouldSendToClient?: (data: any, clientData: ClientData) => boolean
  getMessageType?: (data: any) => string
  getLogIdentifier?: (data: any) => string
}

const peers = new Set<Peer>()
const clientData = new Map<Peer, ClientData>()

export function broadcast(data: any, handler: MessageHandler) {
  const messageType = handler.getMessageType ? handler.getMessageType(data) : 'message'
  const logId = handler.getLogIdentifier ? handler.getLogIdentifier(data) : 'unknown'
  let sentCount = 0

  for (const peer of peers) {
    const cData = clientData.get(peer)
    if (cData && handler.shouldSendToClient && handler.shouldSendToClient(data, cData)) {
      peer.send(
        JSON.stringify({
          type: messageType,
          data: data,
        })
      )
      sentCount++
    }
  }

  if (sentCount > 0) {
    logger.info('Broadcasted message', { 
      messageType, 
      logId, 
      sentCount 
    })
  }
}

function handleSubscription(peer: Peer, topics: string[], handler: MessageHandler) {
  const data = clientData.get(peer)
  if (!data) return

  const validTopicsToAdd = topics.filter((topic) => handler.isValidTopic && handler.isValidTopic(topic))
  const invalidTopics = topics.filter((topic) => !handler.isValidTopic || !handler.isValidTopic(topic))

  if (invalidTopics.length > 0) {
    peer.send(
      JSON.stringify({
        type: 'error',
        message: `Invalid topics: ${invalidTopics.join(', ')}`,
      })
    )
    return
  }

  for (const topic of validTopicsToAdd) {
    if (!data.topics.includes(topic)) {
      data.topics.push(topic)
    }
  }

  peer.send(
    JSON.stringify({
      type: 'subscribed',
      data: { topics: validTopicsToAdd },
    })
  )

  logger.info('Client subscribed', { topics: validTopicsToAdd })
}

function handleUnsubscription(peer: Peer, topics: string[]) {
  const data = clientData.get(peer)
  if (!data) return

  for (const topic of topics) {
    const index = data.topics.indexOf(topic)
    if (index > -1) {
      data.topics.splice(index, 1)
    }
  }

  peer.send(
    JSON.stringify({
      type: 'unsubscribed',
      data: { topics },
    })
  )

  logger.info('Client unsubscribed', { topics })
}

function handleClientMessage(peer: Peer, message: string, handler: MessageHandler) {
  try {
    const parsedMessage: WebSocketMessage = JSON.parse(message)

    switch (parsedMessage.type) {
      case 'subscribe':
        handleSubscription(peer, parsedMessage.topics || [], handler)
        break
      case 'unsubscribe':
        handleUnsubscription(peer, parsedMessage.topics || [])
        break
      case 'ping':
        peer.send(JSON.stringify({ type: 'pong' }))
        break
    }
  } catch (error) {
    peer.send(
      JSON.stringify({
        type: 'error',
        message: `Invalid message format: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    )
  }
}

// Module-level Redis client for pub/sub
const redis = createRedisClient()

redis.subscribe('killmail-broadcasts', (err, count) => {
  if (err) {
    logger.error('Failed to subscribe', { error: err })
  } else {
    logger.info('Subscribed successfully!', { channels: count })
  }
})

// Store handler references for broadcast
const wsHandlers: Set<MessageHandler> = new Set()

redis.on('message', async (channel, message) => {
  try {
    logger.debug('Received message from Redis', { channel, message })
    
    let parsed
    try {
      parsed = JSON.parse(message)
    } catch (err) {
      logger.error('Failed to parse Redis message', { error: err })
      return
    }
    
    // If normalized killmail data is present, broadcast directly
    if (parsed.normalizedKillmail) {
      wsHandlers.forEach(handler => {
        broadcast(parsed.normalizedKillmail, handler)
      })
      return
    }
    
    // Fallback: query database for killmailId (backward compatibility)
    const { killmailId } = parsed
    if (killmailId) {
      const [killmail] = await getFilteredKillsWithNames({ killmailId }, 1, 1)
      if (killmail) {
        const normalized = normalizeKillRow(killmail)
        wsHandlers.forEach(handler => {
          broadcast(normalized, handler)
        })
      }
    }
  } catch (error) {
    logger.error('Failed to process Redis message', { error })
  }
})

export function createWebSocketHandler(handler: MessageHandler) {
  wsHandlers.add(handler)

  return defineWebSocketHandler({
    open(peer) {
      logger.info('WebSocket connection opened', { peer: peer.id || 'unknown' })
      peers.add(peer)
      clientData.set(peer, {
        topics: [],
        connectedAt: new Date(),
      })
    },
    close(peer, details) {
      logger.info('WebSocket connection closed', { peer: peer.id || 'unknown', details })
      peers.delete(peer)
      clientData.delete(peer)
    },
    error(peer, error) {
      logger.error('WebSocket error', { peer: peer.id || 'unknown', error })
    },
    message(peer, message) {
      logger.debug('WebSocket message received', { peer: peer.id || 'unknown', message: message.text() })
      handleClientMessage(peer, message.text(), handler)
    },
  })
}
