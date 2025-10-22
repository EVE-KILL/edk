# ekv4

## Local Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Docker Deployment

### Quick Start

1. **Pull the latest image:**

   ```bash
   docker pull ghcr.io/eve-kill/edk:latest
   ```

2. **Configure environment variables:**

   Copy `.env.example` to `.env` and configure as needed:

   ```bash
   cp .env.example .env
   ```

3. **Create data directory:**

   ```bash
   mkdir -p ./data
   ```

4. **Run the container:**

   ```bash
   docker run -d \
     -p 3000:3000 \
     -v ./data:/app/data \
     --env-file .env \
     --name ekv4 \
     ghcr.io/eve-kill/edk:latest
   ```

### Database Setup

Before bringing up the container (or after for the first time), bootstrap the database:

```bash
docker exec ekv4 bun cli bootstrap
```

This will initialize the database schema and preload static game data (SDE - Static Data Export).

### Backfilling Data

To backfill historical killmail data for specific entities (corporations, alliances, or characters), run:

```bash
docker exec ekv4 bun cli backfill
```

This command uses the entity IDs configured in your `.env` file via `FOLLOWED_*` environment variables to backfill killmails.

### Monitoring

View container logs:

```bash
docker logs -f ekv4
```

The container runs supervisord with:

- **web** - Main HTTP server (port 3000)
- **queue** - Background job queue worker
- **redisq** - Redis queue manager (optional)
- **cronjob** - Scheduled maintenance tasks

---

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
