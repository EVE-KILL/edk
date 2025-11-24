import { database } from './database';

/**
 * Get approximate row count for a table using PostgreSQL statistics
 * 
 * This uses pg_class.reltuples which is updated by VACUUM/ANALYZE
 * and is MUCH faster than COUNT(*) for large tables.
 * 
 * Note: For partitioned tables, query the parent table name to get
 * the total across all partitions.
 * 
 * @param tableName - Table name to get count for
 * @returns Approximate row count (can be slightly stale)
 */
export async function getApproximateCount(tableName: string): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COALESCE(reltuples::bigint, 0) as count 
     FROM pg_class 
     WHERE relname = :tableName`,
    { tableName }
  );
  
  return Number(result?.count || 0);
}

/**
 * Get approximate counts for multiple tables in a single query
 * 
 * @param tableNames - Array of table names
 * @returns Object mapping table name to approximate count
 */
export async function getApproximateCounts(
  tableNames: string[]
): Promise<Record<string, number>> {
  if (tableNames.length === 0) return {};
  
  const placeholders = tableNames.map((_, idx) => `:table${idx}`).join(',');
  const params: Record<string, string> = {};
  tableNames.forEach((name, idx) => {
    params[`table${idx}`] = name;
  });
  
  const results = await database.find<{ relname: string; count: number }>(
    `SELECT relname, COALESCE(reltuples::bigint, 0) as count 
     FROM pg_class 
     WHERE relname IN (${placeholders})`,
    params
  );
  
  const counts: Record<string, number> = {};
  for (const table of tableNames) {
    const result = results.find((r) => r.relname === table);
    counts[table] = result ? Number(result.count) : 0;
  }
  
  return counts;
}

/**
 * Get exact count (slower but accurate)
 * Use this for small tables or when you need exact numbers
 */
export async function getExactCount(tableName: string, whereClause?: string): Promise<number> {
  const where = whereClause ? `WHERE ${whereClause}` : '';
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM "${tableName}" ${where}`
  );
  
  return Number(result?.count || 0);
}
