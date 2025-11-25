/**
 * Count Estimation Helper
 * 
 * Provides fast approximate counts using PostgreSQL's query planner estimates
 * instead of expensive COUNT(*) queries that scan all matching rows.
 * 
 * For pagination and UI display, approximate counts are sufficient and
 * dramatically faster (100-1000x speedup on large tables).
 * 
 * Uses EXPLAIN to extract the query planner's row estimate, which leverages
 * table statistics, indexes, and filter selectivity calculations.
 */

import { database } from './database';

interface ExplainPlan {
  'QUERY PLAN': Array<{
    Plan?: {
      'Plan Rows'?: number;
      'Total Cost'?: number;
      Plans?: ExplainPlan['QUERY PLAN'];
    };
  }>;
}

/**
 * Extract estimated row count from EXPLAIN output
 */
function extractRowEstimate(explainResult: ExplainPlan): number {
  const queryPlan = explainResult['QUERY PLAN']?.[0];
  if (!queryPlan?.Plan) {
    return 0;
  }

  // For simple queries, Plan Rows is at the top level
  if (queryPlan.Plan['Plan Rows'] !== undefined) {
    return queryPlan.Plan['Plan Rows'];
  }

  // For complex queries with subplans, recursively find the row estimate
  // Usually we want the top-level aggregate estimate
  function findRowEstimate(plan: any): number {
    if (plan['Plan Rows'] !== undefined) {
      return plan['Plan Rows'];
    }
    if (plan.Plans && Array.isArray(plan.Plans)) {
      // Return the first plan's estimate (usually the aggregate)
      return findRowEstimate(plan.Plans[0]);
    }
    return 0;
  }

  return findRowEstimate(queryPlan.Plan);
}

/**
 * Estimate row count for a query using EXPLAIN
 * 
 * This extracts PostgreSQL's query planner estimate without executing the query.
 * The estimate is based on:
 * - Table statistics (from ANALYZE)
 * - Index selectivity
 * - Filter conditions
 * - Join cardinality estimates
 * 
 * @param queryFragment - The SQL query to estimate (should be a complete SELECT query)
 * @returns Estimated row count (rounded to nearest integer)
 * 
 * @example
 * ```typescript
 * const estimate = await estimateCount(database.sql`
 *   SELECT 1 FROM killmails 
 *   WHERE "killmailTime" > ${startDate} 
 *     AND "regionId" = ${regionId}
 * `);
 * // Returns: ~23450 (fast, no table scan)
 * ```
 */
export async function estimateCount(
  queryFragment: ReturnType<typeof database.sql>
): Promise<number> {
  try {
    // Execute EXPLAIN to get query planner's row estimate
    const explainResult = await database.sql<ExplainPlan[]>`
      EXPLAIN (FORMAT JSON) ${queryFragment}
    `;

    if (!explainResult || explainResult.length === 0) {
      return 0;
    }

    const estimate = extractRowEstimate(explainResult[0]);
    
    // Round to nearest integer (estimates can be fractional)
    return Math.round(estimate);
  } catch (error) {
    // If EXPLAIN fails, return 0 rather than throwing
    // This allows graceful degradation
    console.error('Failed to estimate count via EXPLAIN:', error);
    return 0;
  }
}

/**
 * Estimate count with a fallback to exact count for small results
 * 
 * For queries that the planner estimates will return few rows,
 * it may be faster to just do an exact count.
 * 
 * @param queryFragment - The SQL query to estimate
 * @param exactCountThreshold - If estimate is below this, do exact count (default: 1000)
 * @returns Row count (estimated or exact)
 */
export async function estimateCountWithFallback(
  queryFragment: ReturnType<typeof database.sql>,
  exactCountThreshold: number = 1000
): Promise<number> {
  const estimate = await estimateCount(queryFragment);

  // If estimate is small, doing an exact count might be faster
  if (estimate > 0 && estimate < exactCountThreshold) {
    try {
      // Build exact count query from the fragment
      // This is a bit hacky but works for SELECT 1 FROM ... queries
      const countQuery = database.sql`
        SELECT COUNT(*) as count FROM (${queryFragment}) as subquery
      `;
      const [result] = await countQuery as unknown as [{ count: number }];
      return Number(result?.count || 0);
    } catch {
      // If exact count fails, return estimate
      return estimate;
    }
  }

  return estimate;
}

/**
 * Format count for display with approximate indicator
 * 
 * @param count - The count to format
 * @param isEstimate - Whether this is an estimate (adds ~ prefix)
 * @returns Formatted string like "~23,450" or "1,234"
 * 
 * @example
 * ```typescript
 * formatCount(23450, true)   // "~23,450"
 * formatCount(1234, false)   // "1,234"
 * formatCount(1234567, true) // "~1.2M"
 * ```
 */
export function formatCount(count: number, isEstimate: boolean = false): string {
  const prefix = isEstimate ? '~' : '';
  
  if (count >= 1_000_000) {
    return `${prefix}${(count / 1_000_000).toFixed(1)}M`;
  }
  
  if (count >= 10_000) {
    return `${prefix}${(count / 1_000).toFixed(1)}k`;
  }
  
  return `${prefix}${count.toLocaleString()}`;
}

/**
 * Get table row count estimate from pg_class statistics
 * 
 * This is extremely fast (metadata lookup) but only works for unfiltered
 * table counts. Useful for "total killmails in database" type queries.
 * 
 * @param tableName - Name of the table (or partition pattern)
 * @returns Estimated total rows
 * 
 * @example
 * ```typescript
 * // Get total killmails across all partitions
 * const total = await getTableEstimate('killmails_%');
 * ```
 */
export async function getTableEstimate(tableName: string): Promise<number> {
  let query;
  
  if (tableName.includes('%')) {
    query = database.sql<{ count: string }[]>`
      SELECT sum(reltuples)::bigint as count
      FROM pg_class
      WHERE relname LIKE ${tableName}
        AND relkind = 'r'
    `;
  } else {
    query = database.sql<{ count: string }[]>`
      SELECT sum(reltuples)::bigint as count
      FROM pg_class
      WHERE relname = ${tableName}
        AND relkind = 'r'
    `;
  }
  
  const [result] = await query;
  return Number(result?.count || 0);
}
