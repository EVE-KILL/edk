import { SQL } from 'bun';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

describe('Bun SQL Array Behavior', () => {
    let client: SQL;

    beforeAll(() => {
        client = new SQL(process.env.DATABASE_URL!);
    });

    it('binds array as string literal', async () => {
        try {
            // Manually format as Postgres array string
            const arrayStr = '{1,2,3}';
            const res = await client.unsafe('SELECT 1 as val WHERE 1 = ANY($1::int[])', [arrayStr]);
            console.log('ANY($1::int[]) with string result:', res);
            expect(res.length).toBe(1);
        } catch (e) {
            console.error('ANY($1::int[]) with string error:', e);
        }
    });
});
