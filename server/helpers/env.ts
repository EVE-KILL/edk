import { z } from 'zod';

const DEFAULT_DATABASE_URL =
  'postgresql://edk_user:edk_password@localhost:5432/edk';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.string().url().default(DEFAULT_DATABASE_URL),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDISQ_ID: z.string().optional(),
  THEME: z.string().default('default'),
  SITE_TITLE: z.string().default('EVE-KILL'),
  SITE_SUBTITLE: z.string().default('Real-time Killmail Tracking'),
  SITE_URL: z.string().url().default('https://eve-kill.com'),
  IMAGE_SERVER_URL: z.string().url().default('https://images.eve-kill.com'),
  TWITTER_HANDLE: z.string().optional(),
  ESI_SERVER_URL: z.string().url().default('https://esi.evetech.net'),
  USER_AGENT: z
    .string()
    .default('EVE-KILL/1.0 (https://eve-kill.com; contact@eve-kill.com)'),
  EVE_CLIENT_ID: z.string().optional(),
  EVE_CLIENT_SECRET: z.string().optional(),
  EVE_CLIENT_REDIRECT: z.string().optional(),
  EVE_CLIENT_ID_DEV: z.string().optional(),
  EVE_CLIENT_SECRET_DEV: z.string().optional(),
  EVE_CLIENT_REDIRECT_DEV: z.string().optional(),
  EVE_CLIENT_SCOPES: z
    .string()
    .default(
      'publicData esi-killmails.read_killmails.v1 esi-killmails.read_corporation_killmails.v1'
    ),
  SESSION_COOKIE_NAME: z.string().default('edk_session'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  FOLLOWED_CHARACTER_IDS: z.string().optional(),
  FOLLOWED_CORPORATION_IDS: z.string().optional(),
  FOLLOWED_ALLIANCE_IDS: z.string().optional(),
  POSTGRES_DB: z.string().default('edk'),
  TEST_DB_NAME: z.string().default('edk_test'),
  DB_USER: z.string().default('edk_user'),
  DB_PASSWORD: z.string().default('edk_password'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('edk'),
  ADMIN_DB_NAME: z.string().default('edk'),
  ADMIN_DATABASE_URL: z.string().url().optional(),

  TYPESENSE_HOST: z.string().default('localhost'),
  TYPESENSE_PORT: z.coerce.number().default(8108),
  TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('http'),
  TYPESENSE_API_KEY: z.string().default('xyz'),
  RATE_LIMIT_KILLMAIL_WINDOW: z.coerce.number().default(60),
  RATE_LIMIT_KILLMAIL_MAX: z.coerce.number().default(50),
  RATE_LIMIT_DEFAULT_WINDOW: z.coerce.number().default(60),
  RATE_LIMIT_DEFAULT_MAX: z.coerce.number().default(100),
  WS_PORT: z.coerce.number().default(3002),
  WS_HOST: z.string().default('0.0.0.0'),
  WS_URL: z.string().default('ws://localhost:3002'),
  WS_PING_INTERVAL: z.coerce.number().default(30000),
  WS_PING_TIMEOUT: z.coerce.number().default(10000),
  WS_CLEANUP_INTERVAL: z.coerce.number().default(60000),
  npm_package_version: z.string().optional(),
  BUILD_DATE: z.string().optional(),
  DEBUG: z.string().optional(),
  HOST: z.string().optional(),
  PORT: z.coerce.number().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('x-ai/grok-2-1212'),
});

export type Env = z.infer<typeof envSchema>;

export let env: Env = envSchema.parse(process.env);

export const refreshEnv = (): Env => {
  env = envSchema.parse(process.env);
  return env;
};

const parseIdList = (value?: string): number[] =>
  value
    ?.split(',')
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id) && id > 0) || [];

export const getFollowedEntities = () => ({
  characters: parseIdList(env.FOLLOWED_CHARACTER_IDS),
  corporations: parseIdList(env.FOLLOWED_CORPORATION_IDS),
  alliances: parseIdList(env.FOLLOWED_ALLIANCE_IDS),
});
