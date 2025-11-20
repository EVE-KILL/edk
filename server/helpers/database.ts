import { createClient, type ClickHouseClient } from '@clickhouse/client'

/**
 * ClickHouse Database Helper
 *
 * Provides a convenient interface for database operations using ClickHouse.
 * Handles connection management and provides common query patterns.
 */
export class DatabaseHelper {
  private client: ClickHouseClient
  private isConnected: boolean = false

  constructor() {
    this.client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER || 'edk_user',
      password: process.env.CLICKHOUSE_PASSWORD || 'edk_password',
      database: process.env.CLICKHOUSE_DB || 'edk',
      clickhouse_settings: {
        // Enable JSON output format by default
        output_format_json_quote_64bit_integers: 0,
        // Set timeout
        max_execution_time: 60
      }
    })
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.ping()
        this.isConnected = true
        console.log('🎯 ClickHouse database connection established')
      } catch (error) {
        console.error('❌ Failed to connect to ClickHouse:', error)
        throw error
      }
    }
  }

  /**
   * Execute a query and return results
   */
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
    await this.ensureConnection()

    try {
      const resultSet = await this.client.query({
        query: sql,
        query_params: params,
        format: 'JSONEachRow'
      })

      const data = await resultSet.json<T>()
      return Array.isArray(data) ? data : [data]
    } catch (error) {
      console.error('ClickHouse query error:', error)
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

    const values = Object.values(result)
    return values.length > 0 ? values[0] as T : null
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   */
  async execute(sql: string, params?: Record<string, any>): Promise<void> {
    await this.ensureConnection()

    try {
      await this.client.exec({
        query: sql,
        query_params: params
      })
    } catch (error) {
      console.error('ClickHouse execute error:', error)
      throw error
    }
  }

  /**
   * Insert data into a table
   */
  async insert<T = any>(table: string, data: T | T[]): Promise<void> {
    await this.ensureConnection()

    try {
      await this.client.insert({
        table,
        values: Array.isArray(data) ? data : [data],
        format: 'JSONEachRow'
      })
    } catch (error) {
      console.error('ClickHouse insert error:', error)
      throw error
    }
  }

  /**
   * Bulk insert data with better performance
   */
  async bulkInsert<T = any>(table: string, data: T[]): Promise<void> {
    if (data.length === 0) return

    await this.ensureConnection()

    try {
      await this.client.insert({
        table,
        values: data,
        format: 'JSONEachRow'
      })
    } catch (error) {
      console.error('ClickHouse bulk insert error:', error)
      throw error
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.queryValue<number>(
        `SELECT 1 FROM system.tables WHERE database = {database:String} AND name = {table:String}`,
        {
          database: process.env.CLICKHOUSE_DB || 'edk',
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
      `SELECT name, type, default_kind, default_expression
       FROM system.columns
       WHERE database = {database:String} AND table = {table:String}
       ORDER BY position`,
      {
        database: process.env.CLICKHOUSE_DB || 'edk',
        table: tableName
      }
    )
  }

  /**
   * Count rows in a table
   */
  async count(table: string, where?: string, params?: Record<string, any>): Promise<number> {
    const sql = `SELECT count(*) as count FROM ${table}${where ? ` WHERE ${where}` : ''}`
    const result = await this.queryValue<number>(sql, params)
    return result || 0
  }

  /**
   * Check database connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.ping()
      return true
    } catch (error) {
      console.error('ClickHouse ping failed:', error)
      return false
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.client.close()
    this.isConnected = false
  }

  /**
   * Get the raw ClickHouse client for advanced operations
   */
  getClient(): ClickHouseClient {
    return this.client
  }
}

// Export a singleton instance
export const database = new DatabaseHelper()

// Export types for convenience
export type QueryParams = Record<string, any>
export type InsertData<T> = T | T[]
