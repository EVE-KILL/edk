# Redis Instance Separation - Migration Guide

## Overview

The project now uses **two separate Redis instances**:

1. **redis-cache** (port 6379) - For caching
2. **redis-queue** (port 6380) - For BullMQ job queues

This separation ensures that clearing the cache does not affect job queue data.

## Configuration

### redis-cache (Port 6379)
- **Purpose**: Application caching, Nitro route cache, WebSocket pub/sub
- **Memory Limit**: 4GB
- **Eviction Policy**: `allkeys-lru` (automatically removes least recently used keys when memory limit is reached)
- **Persistence**: Disabled (no RDB snapshots, no AOF)
- **Environment Variables**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

### redis-queue (Port 6380)
- **Purpose**: BullMQ job queues exclusively
- **Memory Limit**: None
- **Eviction Policy**: None (never removes data)
- **Persistence**: Enabled with both RDB and AOF
  - RDB snapshots: Every 15 minutes if 1+ keys changed, every 5 minutes if 10+ keys changed, every minute if 10000+ keys changed
  - AOF: Append-only file with `everysec` fsync
- **Environment Variables**: `REDIS_QUEUE_HOST`, `REDIS_QUEUE_PORT`, `REDIS_QUEUE_PASSWORD`

## Environment Variables

Add these to your `.env` file:

```bash
# Redis (Cache instance - 4GB limit with LRU eviction)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Redis Queue (BullMQ instance - persistent with RDB)
REDIS_QUEUE_HOST=localhost
REDIS_QUEUE_PORT=6380
REDIS_QUEUE_PASSWORD=redis_password
```

## Migration Steps

### 1. Stop All Services

```bash
docker compose down
```

### 2. Update Environment Variables

Update your `.env` file with the new Redis queue variables (see above).

### 3. Start New Redis Instances

```bash
docker compose up -d redis-cache redis-queue
```

### 4. Migrate Existing Queue Data (Optional)

If you have important queue data in the old Redis instance, you can migrate it:

```bash
# Connect to old Redis and save data
docker exec edk_redis redis-cli -a redis_password SAVE

# Copy RDB file to new queue instance
docker cp edk_redis:/data/dump.rdb /tmp/dump.rdb
docker cp /tmp/dump.rdb edk_redis_queue:/data/dump.rdb

# Restart queue instance to load data
docker compose restart redis-queue
```

### 5. Start Application Services

```bash
# Start queue workers
bun queue

# Start dev server
bun dev

# Start WebSocket server (if used)
bun ws.ts
```

### 6. Clean Up Old Redis Data (Optional)

Once you've verified everything is working, you can remove the old Redis data:

```bash
rm -rf .data/redis
```

## What Changed

### Code Changes

1. **server/helpers/env.ts**
   - Added `REDIS_QUEUE_HOST`, `REDIS_QUEUE_PORT`, `REDIS_QUEUE_PASSWORD` to environment schema

2. **server/helpers/queue.ts**
   - Updated Redis connection config to use `REDIS_QUEUE_*` variables instead of `REDIS_*`

3. **queue.ts**
   - Updated worker Redis connection to use `REDIS_QUEUE_*` variables

4. **docker-compose.yml**
   - Split single `redis` service into `redis-cache` and `redis-queue`
   - Configured memory limits and persistence settings

5. **docker-compose.prod.yml**
   - Same split as development compose file

### No Changes Needed

- **server/helpers/cache.ts** - Still uses cache Redis (correct)
- **server/helpers/redis.ts** - Still uses cache Redis (correct for pub/sub)
- **ws.ts** - Still uses cache Redis via `createRedisClient()` (correct for messaging)
- **Nitro route caching** - Still uses cache Redis (correct)

## Benefits

✅ **Data Safety**: Clearing cache won't delete queue jobs
✅ **Performance**: Cache can evict old data without affecting queues
✅ **Persistence**: Queue data is saved to disk and survives restarts
✅ **Isolation**: Cache and queue operations don't interfere with each other
✅ **Resource Management**: Clear cache without worrying about queue state

## Troubleshooting

### Queue Workers Not Processing Jobs

Check that queue workers are connecting to the correct Redis:

```bash
# Check redis-queue is running
docker compose ps redis-queue

# Check queue worker logs
bun queue character
```

### Cannot Connect to Redis

Verify environment variables are set correctly:

```bash
echo $REDIS_QUEUE_HOST
echo $REDIS_QUEUE_PORT
echo $REDIS_QUEUE_PASSWORD
```

### Lost Queue Data After Migration

If you forgot to migrate existing queue data, you may need to:

1. Re-enqueue jobs from source data
2. Use backfill commands to regenerate missing jobs

### Cache Not Working

Verify cache Redis is running and accessible:

```bash
docker compose ps redis-cache
docker compose logs redis-cache
```

## Production Deployment

For production deployments using `docker-compose.prod.yml`, the same separation applies. Both Redis instances will use named volumes:

- `redis-queue-data` - Persistent queue data

The cache Redis has no volume as it's ephemeral by design.

## Monitoring

Monitor both Redis instances separately:

```bash
# Cache Redis stats
docker exec edk_redis_cache redis-cli -a redis_password INFO memory

# Queue Redis stats
docker exec edk_redis_queue redis-cli -a redis_password INFO persistence
```

## Kubernetes/Helm Deployment

The Helm chart has been updated to support separate Redis instances.

### Helm Chart Changes

The `chart/values.yaml` now has two Redis configurations:

**redisCache:**
- Service name: `redis-cache`
- 4GB memory limit with `allkeys-lru` eviction
- No persistence (ephemeral)
- Resources: 512Mi request, 4.5Gi limit

**redisQueue:**
- Service name: `redis-queue`
- Persistent volume (10Gi by default)
- RDB + AOF enabled
- Resources: 256Mi request, 1Gi limit

### Helm Values Configuration

Update your `values.yaml` or pass values via `--set`:

```yaml
global:
  env:
    REDIS_HOST: redis-cache
    REDIS_PORT: "6379"
    REDIS_QUEUE_HOST: redis-queue
    REDIS_QUEUE_PORT: "6379"
    sensitive:
      REDIS_PASSWORD: "your-cache-redis-password"
      REDIS_QUEUE_PASSWORD: "your-queue-redis-password"

redisCache:
  enabled: true
  maxMemory: 4gb
  maxMemoryPolicy: allkeys-lru

redisQueue:
  enabled: true
  persistence:
    enabled: true
    size: 10Gi
    storageClass: ""  # Use default or specify
```

### Helm Upgrade

```bash
# Update chart dependencies
cd chart
helm dependency update

# Upgrade the release
helm upgrade edk . \
  --namespace edk \
  --set global.env.sensitive.REDIS_PASSWORD=your-cache-password \
  --set global.env.sensitive.REDIS_QUEUE_PASSWORD=your-queue-password
```

### Kubernetes Migration Steps

1. **Backup existing Redis data** (if you want to preserve queue data):
   ```bash
   kubectl exec -n edk deployment/edk-redis -- redis-cli SAVE
   kubectl cp edk/edk-redis-pod:/data/dump.rdb ./redis-backup.rdb
   ```

2. **Update Helm values** with separate Redis passwords

3. **Upgrade the Helm release** (this will create new Redis instances)

4. **Restore queue data** (optional):
   ```bash
   # Copy backup to new queue instance
   kubectl cp ./redis-backup.rdb edk/edk-redis-queue-pod:/data/dump.rdb
   kubectl rollout restart deployment/edk-redis-queue -n edk
   ```

5. **Verify services**:
   ```bash
   kubectl get pods -n edk | grep redis
   kubectl logs -n edk deployment/edk-redis-cache
   kubectl logs -n edk deployment/edk-redis-queue
   ```

### Storage Considerations

The queue Redis uses a PersistentVolumeClaim. Ensure your cluster has:
- Available storage class (or specify one in values)
- Sufficient storage quota
- Backup solution for the PVC

## Rollback

To rollback to a single Redis instance:

1. Stop services: `docker compose down`
2. Revert code changes in this commit
3. Update `.env` to only have `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
4. Start services: `docker compose up -d`

For Helm deployments, downgrade to the previous chart version.
