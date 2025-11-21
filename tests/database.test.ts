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

  it('should prepare queries with parameters', async () => {
    const result = await database.queryValue('SELECT 1 as val WHERE 1 = {num:UInt32}', { num: 1 })
    expect(Number(result)).toBe(1)
  })

  it('should handle array parameters', async () => {
    // postgres.js handles arrays natively, so we don't need manual casting in SQL if the driver does it right.
    // However, our SQL uses `ANY({ids:Array...})`.
    // If we pass an array `[1, 2, 3]`, `postgres.js` serializes it to a Postgres array literal `{1,2,3}` or appropriate binding.
    // `ANY($1)` works if $1 is an array.

    const result = await database.queryValue('SELECT 1 as val WHERE 1 = ANY({ids:Array(UInt32)})', { ids: [1, 2, 3] })
    expect(Number(result)).toBe(1)
  })

  it('should handle Date parameters', async () => {
    const now = new Date()
    const result = await database.queryValue<string>('SELECT {date:Date}::text', { date: now.toISOString() })
    // Check if date matches (ignoring potential TZ differences in string format if just checking day)
    expect(new Date(result!).getDate()).toBe(now.getDate())
  })

  it('should return null for empty result', async () => {
    const result = await database.queryOne('SELECT * FROM information_schema.tables WHERE table_name = {name:String}', { name: 'non_existent_table_xyz' })
    expect(result).toBeNull()
  })
})
