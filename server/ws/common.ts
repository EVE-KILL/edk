import { Peer } from 'crossws'
import Redis from 'ioredis'
import { getFilteredKillsWithNames } from '~/models/killlist'
import { normalizeKillRow } from '~/helpers/templates'

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
    console.log(`📡 Broadcasted ${messageType} ${logId} to ${sentCount} client(s)`)
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

  console.log(`📝 Client subscribed to: ${validTopicsToAdd.join(', ')}`)
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

  console.log(`📝 Client unsubscribed from: ${topics.join(', ')}`)
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

export function createWebSocketHandler(handler: MessageHandler) {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
  })

  redis.subscribe('killmail-broadcasts', (err, count) => {
    if (err) {
      console.error('Failed to subscribe: %s', err.message)
    } else {
      console.log(
        `Subscribed successfully! This client is currently subscribed to ${count} channels.`
      )
    }
  })

  redis.on('message', async (channel, message) => {
    console.log(`Received ${message} from ${channel}`)
    const { killmailId } = JSON.parse(message)
    const [killmail] = await getFilteredKillsWithNames({ killmailId }, 1, 1)
    if (killmail) {
      const normalized = normalizeKillRow(killmail)
      broadcast(normalized, handler)
    }
  })

  return defineWebSocketHandler({
    open(peer) {
      console.log('[ws] open', peer)
      peers.add(peer)
      clientData.set(peer, {
        topics: [],
        connectedAt: new Date(),
      })
    },
    close(peer, details) {
      console.log('[ws] close', peer, details)
      peers.delete(peer)
      clientData.delete(peer)
    },
    error(peer, error) {
      console.error('[ws] error', peer, error)
    },
    message(peer, message) {
      console.log('[ws] message', peer, message)
      handleClientMessage(peer, message.text(), handler)
    },
  })
}
