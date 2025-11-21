import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { database } from '../server/helpers/database'

describe('DatabaseHelper', () => {
  beforeAll(async () => {
    // Ensure DB is ready
    await database.ping()
  })

  it('should be connected', async () => {
    const connected = await database.ping()
    expect(connected).toBe(true)
  })

  it('should execute queries with postgres.js template literals', async () => {
    const num = 1
    const [result] = await database.sql`SELECT 1 as val WHERE 1 = ${num}`
    expect(Number(result.val)).toBe(1)
  })

  it('should handle array parameters natively', async () => {
    const ids = [1, 2, 3]
    // postgres.js handles arrays natively
    const [result] = await database.sql`SELECT 1 as val WHERE 1 = ANY(${ids})`
    expect(Number(result.val)).toBe(1)
  })

  it('should handle Date parameters', async () => {
    const now = new Date()
    // postgres.js handles Date objects
    const [result] = await database.sql`SELECT ${now}::text as date_str`
    expect(new Date(result.date_str).getDate()).toBe(now.getDate())
  })

  it('should return empty array for empty result', async () => {
    const name = 'non_existent_table_xyz'
    const result = await database.sql`SELECT * FROM information_schema.tables WHERE table_name = ${name}`
    expect(result.length).toBe(0)
  })
})
