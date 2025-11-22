import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10)

export const storage = createStorage({
  driver: redisDriver({
    host: REDIS_HOST,
    port: REDIS_PORT,
    /* other redis connection options */
  }),
})
