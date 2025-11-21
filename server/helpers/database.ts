import postgres from 'postgres'

/**
 * Postgres Database Helper (using postgres.js)
 *
 * Provides a convenient interface for database operations.
 * Handles connection management and provides common query patterns.
 */
export class DatabaseHelper {
  private sql: postgres.Sql
  private isConnected: boolean = false

  constructor() {
    // Initialize postgres client
    const url = process.env.DATABASE_URL || 'postgresql://edk_user:edk_password@localhost:5432/edk'

    // postgres.js manages the connection pool automatically
    this.sql = postgres(url, {
      max: 10, // Max connections
      idle_timeout: 20, // Idle connection timeout in seconds
      connect_timeout: 10, // Connection timeout
      transform: {
        // Optional: convert row keys to camelCase if needed, but we stick to schema for now
        // undefined
      }
    })
    this.isConnected = true
  }

  /**
   * Helper to convert ClickHouse-style parameterized queries to postgres.js template strings.
   *
   * ClickHouse: SELECT * FROM table WHERE id = {id:UInt32}
   * postgres.js: sql`SELECT * FROM table WHERE id = ${id}`
   *
   * Since postgres.js uses tagged templates for security, we can't easily just replace strings.
   * We have to parse the SQL and rebuild it as a template literal call or use the unsafe helper with parameters carefully.
   *
   * However, postgres.js doesn't support named parameters in raw text like `$name`.
   * It supports `${ sql(value) }`.
   *
   * To maintain compatibility with the existing `{param:Type}` syntax used everywhere in the codebase,
   * we will parse the SQL string, replace `{key}` with `$1`, `$2`, etc., and construct the values array.
   * Then we use `sql.unsafe(text, values)`.
   */
  private prepareQuery(sql: string, params?: Record<string, any>): { text: string, values: any[] } {
    if (!params) return { text: sql, values: [] }

    const values: any[] = []
    const paramMap = new Map<string, number>()
    let nextIndex = 1

    // Regex to match {key:Type} or {key}
    // Handles: {id:UInt32}, {ids:Array(UInt32)}, {name:String}, {name}
    const paramRegex = /{([a-zA-Z0-9_]+)(?::[a-zA-Z0-9_()\[\]]+)?}/g

    const text = sql.replace(paramRegex, (match, name) => {
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
      // Use unsafe to execute raw SQL with parameterized values
      // postgres.js unsafe(query, parameters)
      const result = await this.sql.unsafe(text, values)
      return result as unknown as T[]
    } catch (error) {
      console.error('Database query error:', error)
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
  async insert<T extends object = any>(table: string, data: T | T[]): Promise<void> {
    const items = Array.isArray(data) ? data : [data]
    if (items.length === 0) return

    try {
      // postgres.js has a nice helper for inserts: sql(items)
      await this.sql`INSERT INTO ${this.sql(table)} ${this.sql(items)}`
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
        const columns = Object.keys(items[0])

        await this.sql`
            INSERT INTO ${this.sql(table)} ${this.sql(items)}
            ON CONFLICT (${this.sql(conflictKey)})
            DO UPDATE SET ${this.sql(items[0], columns.filter(c => c !== conflictKey))}
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
      const result = await this.queryValue<number>(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = {table:String}`,
        {
          table: tableName
        }
      )
      return Number(result) === 1
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
    // Need to use unsafe for table name injection if it's dynamic string,
    // but unsafe doesn't support tagged template logic for table identifiers easily mixed with raw strings.
    // Safest is to query: SELECT count(*) FROM "table" ...

    // Construct WHERE clause manually with placeholders
    let queryText = `SELECT count(*) as count FROM "${table}"`
    if (where) {
        queryText += ` WHERE ${where}`
    }

    const result = await this.queryValue<any>(queryText, params)
    return Number(result) || 0
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
    await this.sql.end()
    this.isConnected = false
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
