import { describe, test, expect } from 'bun:test'
import { database } from '../../server/helpers/database'
import handler from '../../server/api/killmail/[id]/esi.get'
import { H3Event } from 'h3'

describe('API Handler: GET /api/killmail/:id/esi', () => {
  test('should return a killmail in ESI format', async () => {
    // 1. Seed a killmail directly into the database
    const killmailId = 987654321
    await database.sql`
      INSERT INTO killmails ("killmailId", "hash", "killmailTime", "solarSystemId", "victimDamageTaken", "victimCorporationId", "victimShipTypeId")
      VALUES (${killmailId}, 'test_hash', '2024-01-01T12:00:00Z', 30000142, 1000, 1000001, 670)
    `

    // 2. Mock the H3Event object
    const event = {
      context: {
        params: {
          id: String(killmailId)
        }
      }
    } as unknown as H3Event

    // 3. Call the handler function
    const response = await handler(event)

    // 4. Assert the response is correct
    expect(response.killmail_id).toBe(killmailId)
    expect(response.solar_system_id).toBe(30000142)
  })

  test('should throw a 404 for a non-existent killmail', async () => {
    const nonExistentId = 1
    const event = {
      context: {
        params: {
          id: String(nonExistentId)
        }
      }
    } as unknown as H3Event

    await expect(handler(event)).rejects.toThrow('Killmail with ID 1 not found')
  })
})
