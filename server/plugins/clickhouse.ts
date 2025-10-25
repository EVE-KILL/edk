import { createClient } from '@clickhouse/client'

let clickhouseClient: any = null

export default async (nitroApp: any) => {
  // Initialize ClickHouse client
  clickhouseClient = createClient({
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

  // Test the connection
  try {
    await clickhouseClient.ping()
    console.log('🎯 ClickHouse connection established successfully')
  } catch (error) {
    console.error('❌ Failed to connect to ClickHouse:', error)
  }
}

// Export the client for use in helpers
export { clickhouseClient }
