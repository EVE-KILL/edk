import { collectStatusSnapshot } from '../helpers/status';
import { handleError } from '../utils/error';

/**
 * @openapi
 * /api/status:
 *   get:
 *     summary: Get system status
 *     description: Returns comprehensive system status including database, queue, Redis, WebSocket, and system metrics.
 *     tags:
 *       - Status
 *     responses:
 *       '200':
 *         description: System status snapshot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               timestamp: "2025-12-01T12:34:56.789Z"
 *               database:
 *                 tables:
 *                   - name: "killmails"
 *                     count: 15234567
 *                     size: "42 GB"
 *                   - name: "characters"
 *                     count: 1234567
 *                     size: "256 MB"
 *                   - name: "corporations"
 *                     count: 456789
 *                     size: "128 MB"
 *                 recentKillmails24h: 12345
 *                 activeConnections: 15
 *                 databaseSize: "125 GB"
 *                 killmailsRelatedSize: "95 GB"
 *               queues:
 *                 character:
 *                   active: 5
 *                   waiting: 234
 *                   prioritized: 0
 *                   completed: 1234567
 *                   failed: 42
 *                   delayed: 0
 *                 corporation:
 *                   active: 3
 *                   waiting: 156
 *                   prioritized: 0
 *                   completed: 456789
 *                   failed: 12
 *                   delayed: 0
 *               redis:
 *                 connected: true
 *                 usedMemory: "256 MB"
 *                 keys: 12345
 *                 uptime: 864000
 *               websocket:
 *                 connectedClients: 42
 *                 available: true
 *               system:
 *                 uptimeSeconds: 2592000
 *                 memory:
 *                   rssMb: 512.5
 *                   heapUsedMb: 234.8
 *                   heapTotalMb: 456.2
 */
export default defineEventHandler(async (event) => {
  try {
    setResponseHeaders(event, {
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Type': 'application/json',
    });

    const snapshot = await collectStatusSnapshot();
    return snapshot;
  } catch (error) {
    return handleError(event, error);
  }
});
