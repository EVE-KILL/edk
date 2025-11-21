import postgres from 'postgres'

/**
 * Postgres Database Helper (using postgres.js)
 *
 * Provides a convenient interface for database operations.
 * Handles connection management and provides common query patterns.
 */
export class DatabaseHelper {
  private _sql: postgres.Sql | undefined

  constructor() {}

  get sql(): postgres.Sql {
    if (!this._sql) {
      // Initialize postgres client
      const url = process.env.DATABASE_URL || 'postgresql://edk_user:edk_password@localhost:5432/edk'

      // postgres.js manages the connection pool automatically
      this._sql = postgres(url, {
        max: 10, // Max connections
        idle_timeout: 20, // Idle connection timeout in seconds
        connect_timeout: 10, // Connection timeout
        transform: {
          // Optional: convert row keys to camelCase if needed, but we stick to schema for now
          // undefined
        }
      })
    }
    return this._sql
  }

  /**
   * Insert data into a table
   */
  async insert<T extends object = any>(table: string, data: T | T[]): Promise<void> {
    const items = Array.isArray(data) ? data : [data]
    if (items.length === 0) return

    try {
      // postgres.js has a nice helper for inserts: sql(items)
      await this.sql`INSERT INTO ${this.sql(table)} ${this.sql(items as any)}`
    } catch (error) {
      console.error('Database insert error:', error)
      throw error
    }
  }

  /**
   * Bulk insert data
   */
  async bulkInsert<T extends object = any>(table: string, data: T[]): Promise<void> {
    return this.insert(table, data)
  }

  /**
   * Bulk upsert data
   */
  async bulkUpsert<T extends object = any>(table: string, data: T[], conflictKey: string): Promise<void> {
    const items = Array.isArray(data) ? data : [data]
    if (items.length === 0) return

    try {
        const columns = Object.keys(items[0]).filter(c => c !== conflictKey)

        // Construct dynamic update list: "col" = EXCLUDED."col"
        // Use reduce to join with commas manually to avoid postgres.js array formatting issues in SET clause
        const updateClause = columns.reduce((acc, col, i) => {
          const fragment = this.sql`${this.sql(col)} = EXCLUDED.${this.sql(col)}`
          // Cast to any to avoid complex type inference issues with postgres.js template literals
          return i === 0 ? fragment : this.sql`${acc as any}, ${fragment}`
        }, this.sql``)

        await this.sql`
            INSERT INTO ${this.sql(table)} ${this.sql(items as any)}
            ON CONFLICT (${this.sql(conflictKey)})
            DO UPDATE SET ${updateClause as any}
        `
    } catch (error) {
      console.error('Database upsert error:', error)
      throw error
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const [result] = await this.sql<{exists: number}[]>`
        SELECT 1 as exists FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}
      `
      return Number(result?.exists) === 1
    } catch (error) {
      console.error('Error checking table existence:', error)
      return false
    }
  }

  /**
   * Get table schema information
   */
  async getTableSchema(tableName: string): Promise<any[]> {
    return await this.sql`
      SELECT column_name as name, data_type as type, column_default as "default_expression"
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ${tableName}
       ORDER BY ordinal_position
    `
  }

  /**
   * Execute a raw query
   */
  async query<T = any>(query: string, params?: any[]): Promise<T[]> {
    return await this.sql.unsafe<T[]>(query, params) as T[]
  }

  /**
   * Execute a raw query and return the first row
   */
  async queryOne<T = any>(query: string, params?: any[]): Promise<T | null> {
    const result = await this.sql.unsafe<T[]>(query, params)
    return result.length > 0 ? result[0] : null
  }

  /**
   * Execute a raw query and return the first value of the first row
   */
  async queryValue<T = any>(query: string, params?: any[]): Promise<T | null> {
    const result = await this.sql.unsafe<any[]>(query, params)
    if (result.length > 0) {
      const keys = Object.keys(result[0])
      if (keys.length > 0) {
        return result[0][keys[0]] as T
      }
    }
    return null
  }

  /**
   * Execute a command (alias for query but implies no return value needed)
   */
  async execute(query: string, params?: any[]): Promise<void> {
    await this.sql.unsafe(query, params)
  }

  /**
   * Check database connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.sql`SELECT 1`
      return true
    } catch (error) {
      console.error('Database ping failed:', error)
      return false
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this._sql) {
      await this._sql.end()
      this._sql = undefined
    }
  }

  /**
   * Get the raw client
   */
  getClient(): postgres.Sql {
    return this.sql
  }
}

// Export a singleton instance
export const database = new DatabaseHelper()

// Export types for convenience
export type QueryParams = Record<string, any>
export type InsertData<T> = T | T[]
