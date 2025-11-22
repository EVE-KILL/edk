import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number(),
  REDIS_PASSWORD: z.string().optional(),
  REDISQ_ID: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  THEME: z.string().optional(),
  SITE_TITLE: z.string().optional(),
  SITE_SUBTITLE: z.string().optional(),
  IMAGE_SERVER_URL: z.string().url().optional(),
  ESI_SERVER_URL: z.string().url().optional(),
  FOLLOWED_CHARACTER_IDS: z.string().optional(),
  FOLLOWED_CORPORATION_IDS: z.string().optional(),
  FOLLOWED_ALLIANCE_IDS: z.string().optional(),
  POSTGRES_DB: z.string().optional(),
  TEST_DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  ADMIN_DB_NAME: z.string().optional(),
  ADMIN_DATABASE_URL: z.string().optional(),
})

export const env = envSchema.parse(process.env)
