import postgres from 'postgres'

let postgresClient: postgres.Sql | null = null

export default async (nitroApp: any) => {
  // Initialize Postgres client
  const url = process.env.DATABASE_URL || 'postgresql://edk_user:edk_password@localhost:5432/edk'

  try {
    postgresClient = postgres(url, {
      max: 1, // Minimal connection for health check plugin
      idle_timeout: 5,
      connect_timeout: 5
    })

    // Test the connection
    await postgresClient`SELECT 1`
    logger.info('🎯 Postgres connection established successfully')
  } catch (error) {
    logger.error('❌ Failed to connect to Postgres', { error: String(error) })
  }
}

// Export the client for use in helpers
export { postgresClient }
