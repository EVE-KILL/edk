# Production Deployment Guide

This guide provides a comprehensive overview of how to deploy the EVE-KILL (EDK) application to a production environment.

## 1. Deployment Architecture

A recommended production setup consists of the following components:

- **Application Server(s)**: One or more servers to run the Nitro application, WebSocket server, and background workers (Queues, Cronjobs).
- **Database Server**: A dedicated PostgreSQL instance.
- **Cache/Queue Server**: A dedicated Redis instance.
- **Search Server**: A dedicated Typesense instance.
- **Reverse Proxy/Load Balancer**: Nginx, Caddy, or a cloud load balancer to manage traffic, terminate SSL, and serve static assets.
- **Firewall**: Restrict access to services (e.g., only allow the application servers to connect to the database).

## 2. Environment Setup

Create a `.env` file in the root of your project for production. **Do not commit this file to version control.**

### Key Production Environment Variables

- **`NODE_ENV`**: Must be set to `production`.
- **`LOG_LEVEL`**: Set to `info` for production logging.
- **`DATABASE_URL`**: Connection string for your production PostgreSQL database.
  - Example: `postgres://user:password@host:port/database?sslmode=require`
- **`REDIS_URL`**: Connection string for your production Redis instance.
  - Example: `redis://:password@host:port/0`
- **`TYPESENSE_API_KEY`**: A securely generated API key for Typesense.
- **`TYPESENSE_HOST`**: The hostname of your Typesense server.
- **`REDISQ_ID`**: Your zKillboard RedisQ ID for killmail ingestion.

## 3. Docker Deployment

Using Docker is the recommended way to deploy the application.

### Production-Ready Dockerfile

A production-ready `Dockerfile` is provided in the root of the project. It builds the application in a multi-stage process to create a small, optimized production image.

### Production Docker Compose (`docker-compose.prod.yml`)

A `docker-compose.prod.yml` file is provided as an example for running the entire stack. This is suitable for single-server deployments.

**To run:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

## 4. Reverse Proxy

A reverse proxy is essential for SSL/TLS termination, load balancing, and serving static assets.

### Nginx Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://localhost:3000; # Assuming app runs on port 3000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. SSL/TLS

Use a service like Let's Encrypt to obtain free SSL/TLS certificates. Tools like `certbot` can automate this process.

## 6. Database (PostgreSQL)

- **Tuning**: Adjust `postgresql.conf` for production loads. Key settings include `shared_buffers`, `work_mem`, and `effective_cache_size`. Use a tool like `pgtune` to generate a baseline configuration.
- **Connection Pooling**: For larger deployments, consider using an external connection pooler like PgBouncer.
- **Security**: Ensure your database is not publicly accessible. Use strong passwords and configure `pg_hba.conf` to only allow connections from trusted IP addresses.

## 7. Redis

- **Persistence**: Configure Redis for AOF (Append Only File) persistence to ensure data is not lost on restart.
- **Security**: Set a strong password in your `redis.conf` and bind Redis to a private network interface.

## 8. Monitoring

- **Application Logging**: The application uses a structured logger. In production, you should ship these logs to a log management service (e.g., Grafana Loki, Datadog, ELK stack).
- **Metrics**: The project includes a `/metrics` endpoint for Prometheus. Scrape this endpoint to monitor application health, request rates, and performance.
- **Health Checks**: The `/health` endpoint can be used by load balancers or uptime checkers to verify the application is running.

## 9. Backups

- **Database**: Use `pg_dump` to create regular backups of your PostgreSQL database. Store these backups in a secure, off-site location (e.g., S3).
- **Redis**: While Redis is mostly used for transient data (queues, caches), you can create snapshots if you have critical data stored there.

**Example pg_dump script:**
```bash
#!/bin/bash
DB_NAME="your_db"
BACKUP_DIR="/path/to/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
pg_dump -U your_user -d $DB_NAME -F c -b -v -f "$BACKUP_DIR/$DB_NAME-$DATE.backup"
```

## 10. Scaling

- **Stateless Application**: The main Nitro application is stateless and can be scaled horizontally by running multiple instances behind a load balancer.
- **Workers**: You can run the Queue, Cronjob, and WebSocket servers on separate machines to distribute the load.
- **Database Scaling**: For very high traffic, you may need to scale your database using read replicas.

## 11. Security

Refer to `docs/security.md` for a detailed security checklist.
