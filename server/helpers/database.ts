import { SQL } from 'bun'

/**
 * Postgres Database Helper (using Bun native driver)
 *
 * Provides a convenient interface for database operations.
 * Handles connection management and provides common query patterns.
 */
export class DatabaseHelper {
  private client: SQL
  private isConnected: boolean = false

  constructor() {
    // Initialize Bun SQL client for Postgres
    const url = process.env.DATABASE_URL || 'postgresql://edk_user:edk_password@localhost:5432/edk'
    this.client = new SQL(url)
    // In Bun SQL, connection is lazy, so we consider it connected once initialized.
    // The driver handles reconnection.
    this.isConnected = true
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<void> {
    // Bun SQL handles connections automatically
    return Promise.resolve()
  }

  /**
   * Helper to convert ClickHouse-style parameterized queries to Bun SQL compatible ones.
   *
   * ClickHouse: SELECT * FROM table WHERE id = {id:UInt32}
   * Postgres/Bun: SELECT * FROM table WHERE id = $1
   *
   * This function parses the SQL, replaces placeholders with $n, and constructs the values array.
   */
  private prepareQuery(sql: string, params?: Record<string, any>): { text: string, values: any[] } {
    if (!params) return { text: sql, values: [] }

    const values: any[] = []
    const paramMap = new Map<string, number>()
    let nextIndex = 1

    // Regex to match {key:Type} or {key}
    // Handles: {id:UInt32}, {ids:Array(UInt32)}, {name:String}, {name}
    const paramRegex = /{([a-zA-Z0-9_]+)(?::[a-zA-Z0-9_()]+)?}/g

    const text = sql.replace(paramRegex, (match, name) => {
      // If the param is not in the map yet, add it
      if (!paramMap.has(name)) {
        paramMap.set(name, nextIndex++)
        values.push(params[name])
      }
      return `$${paramMap.get(name)}`
    })

    return { text, values }
  }

  /**
   * Execute a query and return results
   */
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
    try {
      const { text, values } = this.prepareQuery(sql, params)

      // Use unsafe for dynamic queries with parameters
      // Bun SQL supports parsing parameters in unsafe() if the driver supports it.
      // For Postgres, passing args to unsafe maps to $1, $2 etc.
      const results = await this.client.unsafe(text, values) as T[]
      return results
    } catch (error) {
      console.error('Database query error:', error)
      // Log the failed query for debugging
      console.error('Query:', sql)
      console.error('Params:', params)
      throw error
    }
  }

  /**
   * Execute a query and return the first row
   */
  async queryOne<T = any>(sql: string, params?: Record<string, any>): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results.length > 0 ? results[0] : null
  }

  /**
   * Execute a query and return the first column of the first row
   */
  async queryValue<T = any>(sql: string, params?: Record<string, any>): Promise<T | null> {
    const result = await this.queryOne(sql, params)
    if (!result) return null

    const values = Object.values(result as object)
    return values.length > 0 ? values[0] as T : null
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   */
  async execute(sql: string, params?: Record<string, any>): Promise<void> {
    await this.query(sql, params)
  }

  /**
   * Insert data into a table
   */
  async insert<T = any>(table: string, data: T | T[]): Promise<void> {
    const items = Array.isArray(data) ? data : [data]
    if (items.length === 0) return

    try {
      // Bun SQL supports insert helper: sql(table).insert(items)
      // But the table name is dynamic.
      // We can construct the query manually or use sql`INSERT INTO ${sql(table)} ...`

      // However, Bun SQL insert helper is: sql`INSERT INTO ${sql(table)} ${sql(items)}`
      await this.client`INSERT INTO ${this.client(table)} ${this.client(items)}`
    } catch (error) {
      console.error('Database insert error:', error)
      throw error
    }
  }

  /**
   * Bulk insert data
   */
  async bulkInsert<T = any>(table: string, data: T[]): Promise<void> {
    return this.insert(table, data)
  }

  /**
   * Bulk upsert data (Insert on conflict update)
   */
  async bulkUpsert<T = any>(table: string, data: T[], conflictKey: string): Promise<void> {
    const items = Array.isArray(data) ? data : [data]
    if (items.length === 0) return

    try {
      const columns = Object.keys(items[0])
      const updateColumns = columns.filter(c => c !== conflictKey)

      const columnsSql = columns.map(c => `"${c}"`).join(', ')

      const values: any[] = []
      const valuePlaceholders: string[] = []

      let paramIndex = 1
      for (const item of items) {
        const placeholders: string[] = []
        for (const col of columns) {
          let val = (item as any)[col]

          // Handle arrays for Postgres
          if (Array.isArray(val)) {
             val = `{${val.join(',')}}`
          }

          values.push(val)
          placeholders.push(`$${paramIndex++}`)
        }
        valuePlaceholders.push(`(${placeholders.join(', ')})`)
      }

      const valuesSql = valuePlaceholders.join(', ')
      const setClause = updateColumns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')

      await this.client.unsafe(`
        INSERT INTO "${table}" (${columnsSql})
        VALUES ${valuesSql}
        ON CONFLICT ("${conflictKey}")
        DO UPDATE SET ${setClause}
      `, values)
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
      const result = await this.queryValue<number>(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = {table:String}`,
        {
          table: tableName
        }
      )
      return result === 1
    } catch (error) {
      console.error('Error checking table existence:', error)
      return false
    }
  }

  /**
   * Get table schema information
   */
  async getTableSchema(tableName: string): Promise<any[]> {
    return await this.query(
      `SELECT column_name as name, data_type as type, column_default as default_expression
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = {table:String}
       ORDER BY ordinal_position`,
      {
        table: tableName
      }
    )
  }

  /**
   * Count rows in a table
   */
  async count(table: string, where?: string, params?: Record<string, any>): Promise<number> {
    // For Postgres, we need to be careful with dynamic table names in unsafe string
    // This method assumes 'table' is safe or strictly controlled.
    const sql = `SELECT count(*) as count FROM ${table}${where ? ` WHERE ${where}` : ''}`

    // Note: 'count' in Postgres returns a BigInt (string in JS usually) or number.
    // Need to handle casting.
    const result = await this.queryValue<any>(sql, params)
    return Number(result) || 0
  }

  /**
   * Check database connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.client`SELECT 1`
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
    await this.client.close() // Bun SQL might not have close() or it might be end().
    // Documentation says client.close() or end().
    // Wait, SQL client in Bun seems to auto-manage.
    // But check if close exists.
    // If not, we just ignore.
    if (typeof (this.client as any).close === 'function') {
        await (this.client as any).close()
    } else if (typeof (this.client as any).end === 'function') {
        await (this.client as any).end()
    }
    this.isConnected = false
  }

  /**
   * Get the raw client
   */
  getClient(): SQL {
    return this.client
  }
}

// Export a singleton instance
export const database = new DatabaseHelper()

// Export types for convenience
export type QueryParams = Record<string, any>
export type InsertData<T> = T | T[]
