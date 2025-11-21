import { describe, it, expect, beforeAll } from 'bun:test'
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

  it('should handle bulkUpsert correctly with multiple conflicting rows', async () => {
    await database.execute('CREATE TABLE IF NOT EXISTS test_upsert (id INT PRIMARY KEY, val TEXT)');
    await database.execute('DELETE FROM test_upsert');

    // Insert initial data
    await database.insert('test_upsert', [{id: 1, val: 'A'}, {id: 2, val: 'B'}]);

    // Upsert with new values
    await database.bulkUpsert('test_upsert', [{id: 1, val: 'A2'}, {id: 2, val: 'B2'}], 'id');

    const rows = await database.query<any>('SELECT * FROM test_upsert ORDER BY id');
    expect(rows).toHaveLength(2);
    expect(rows[0].val).toBe('A2');
    expect(rows[1].val).toBe('B2');
  })
})
