/**
 * Common WebSocket Server Infrastructure
 * Shared types and interfaces for EVE-KILL WebSocket server
 */

export interface ClientData {
  topics: string[];
  connectedAt: Date;
  lastPing?: Date;
  lastPong?: Date;
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
    | 'unsubscribed';
  message?: string;
  topics?: string[];
  data?: any;
}

export interface MessageHandler {
  isValidTopic?: (topic: string) => boolean;
  generateRoutingKeys?: (data: any) => string[];
  shouldSendToClient?: (data: any, clientData: ClientData) => boolean;
  getMessageType?: (data: any) => string;
  getLogIdentifier?: (data: any) => string;
}
