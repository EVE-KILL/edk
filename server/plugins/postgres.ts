import { SQL } from 'bun';

let postgresClient: SQL | null = null

export default async (nitroApp: any) => {
  const url = process.env.DATABASE_URL || 'postgres://edk_user:edk_password@localhost:5432/edk'

  try {
    postgresClient = new SQL(url)

    // Test the connection
    await postgresClient`SELECT 1`
    console.log('🎯 Postgres connection established successfully')
  } catch (error) {
    console.error('❌ Failed to connect to Postgres:', error)
  }
}

// Export the client for use in helpers
export { postgresClient }
