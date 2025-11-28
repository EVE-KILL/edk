# Configuration

EVE-KILL is configured via environment variables. Copy `.env.example` to `.env` and adjust as needed.

## Required Variables

### PostgreSQL

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=edk
POSTGRES_USER=edk_user
POSTGRES_PASSWORD=your_password
DATABASE_URL=postgresql://edk_user:your_password@localhost:5432/edk
```

### Redis

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_URL=redis://:your_redis_password@localhost:6379
```

## Optional Variables

### Application

```bash
# Site branding
SITE_TITLE=EVE-KILL
SITE_SUBTITLE=Real-time Killmail Tracking

# Theme selection (default: default)
THEME=default
```

### ESI & Images

```bash
# EVE image server URL
IMAGE_SERVER_URL=https://images.evetech.net

# ESI server URL
ESI_SERVER_URL=https://esi.evetech.net
```

### Ingestion

```bash
# zKillboard RedisQ identifier (should be unique per instance)
REDISQ_ID=eve-kill-dev

# EVE SSO credentials for authenticated endpoints
EVE_CLIENT_ID=your_client_id
EVE_CLIENT_SECRET=your_client_secret
EVE_CLIENT_REDIRECT=http://localhost:3000/auth/callback
EVE_CLIENT_SCOPES=publicData esi-killmails.read_killmails.v1
```

### WebSocket Server

```bash
# WebSocket server configuration
WS_PORT=3002
WS_HOST=0.0.0.0
WS_PING_INTERVAL=30000
WS_PING_TIMEOUT=10000
```

### Rate Limiting

```bash
# API rate limits
RATE_LIMIT_DEFAULT_WINDOW=60
RATE_LIMIT_DEFAULT_MAX=100
RATE_LIMIT_KILLMAIL_WINDOW=60
RATE_LIMIT_KILLMAIL_MAX=50
```

### Testing

```bash
# Override test database name (default: edk_test)
TEST_DB_NAME=edk_test
```

### Development

```bash
# Node environment
NODE_ENV=development

# Server port (default: 3000)
PORT=3000
```

### Legacy/Unused

These variables may appear in `.env.example` but are not currently used:

```bash
# Typesense (replaced with PostgreSQL pg_trgm search)
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=xyz
```

## Docker Compose

The included `docker-compose.yml` provides all required services:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: edk
      POSTGRES_USER: edk_user
      POSTGRES_PASSWORD: edk_password
    ports:
      - '5432:5432'
    command: postgres -c max_locks_per_transaction=200

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass redis_password
    ports:
      - '6379:6379'
```

Start with:

```bash
docker compose up -d
```

## PostgreSQL Tuning

For production, consider these settings in `postgresql.conf`:

```ini
# Required for partitions
max_locks_per_transaction = 200

# Performance tuning
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB
```

## Redis Tuning

For production with large queues:

```bash
# Increase max memory
maxmemory 512mb
maxmemory-policy allkeys-lru
```
