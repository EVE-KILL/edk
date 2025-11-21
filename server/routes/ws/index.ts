import { createWebSocketHandler } from '~/ws/common'
import { killmailMessageHandler } from '~/ws/handlers/killmails'

export default createWebSocketHandler(killmailMessageHandler)
