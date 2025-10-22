# Queue & Cronjob Architecture

## Overview

The queue workers and cronjob scheduler now run as **separate CLI commands** instead of being bundled with the web server. This prevents background processing from interfering with web request performance.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Web Server    │     │  Queue Workers   │     │ Cronjob Scheduler  │
│                 │     │                  │     │                    │
│ bun run dev     │     │ bun cli          │     │ bun cli            │
│ or              │     │ queue:work       │     │ cronjobs:run       │
│ bun index.ts    │     │                  │     │                    │
│                 │     │                  │     │                    │
│ - HTTP routes   │     │ - Process jobs   │     │ - Cache cleanup    │
│ - API endpoints │     │ - ESI fetching   │     │ - Entity refresh   │
│ - Static files  │     │ - Price updates  │     │ - Price fetching   │
│                 │     │ - Calculations   │     │ - Maintenance      │
└─────────────────┘     └──────────────────┘     └────────────────────┘
        │                       │                         │
        └───────────────────────┴─────────────────────────┘
                                │
                         ┌──────▼───────┐
                         │   Database   │
                         │  (SQLite)    │
                         └──────────────┘
```

## Running Components

### Web Server Only (Development)
```bash
bun run dev
# or
bun index.ts
```

The web server now runs **without** queue workers or cronjobs by default.

### Queue Workers (Separate Process)
```bash
bun cli queue:work
```

Starts background workers that process:
- Killmail fetching from ESI
- Character/Corporation/Alliance data fetching
- Price data updates
- ISK value calculations

### Cronjob Scheduler (Separate Process)
```bash
bun cli cronjobs:run
```

Runs scheduled maintenance tasks:
- Cache cleanup
- Entity data refresh
- Periodic price updates
- Statistics aggregation

## Production Deployment

Run all three processes separately using a process manager:

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start web server
pm2 start bun --name "eve-kill-web" -- index.ts

# Start queue workers
pm2 start bun --name "eve-kill-queue" -- cli queue:work

# Start cronjobs
pm2 start bun --name "eve-kill-cron" -- cli cronjobs:run

# Save configuration
pm2 save

# Enable startup on boot
pm2 startup
```

### Using systemd

Create three service files:

**`/etc/systemd/system/eve-kill-web.service`**
```ini
[Unit]
Description=EVE Kill Web Server
After=network.target

[Service]
Type=simple
User=evekill
WorkingDirectory=/opt/eve-kill
ExecStart=/usr/bin/bun index.ts
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/eve-kill-queue.service`**
```ini
[Unit]
Description=EVE Kill Queue Workers
After=network.target

[Service]
Type=simple
User=evekill
WorkingDirectory=/opt/eve-kill
ExecStart=/usr/bin/bun cli queue:work
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/eve-kill-cron.service`**
```ini
[Unit]
Description=EVE Kill Cronjob Scheduler
After=network.target

[Service]
Type=simple
User=evekill
WorkingDirectory=/opt/eve-kill
ExecStart=/usr/bin/bun cli cronjobs:run
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl enable eve-kill-web eve-kill-queue eve-kill-cron
sudo systemctl start eve-kill-web eve-kill-queue eve-kill-cron
```

## Environment Variables (Legacy)

If you want to run queue/cronjobs WITH the web server (not recommended):

```env
QUEUE_ENABLED=true        # Enable queue workers in web server
CRONJOBS_ENABLED=true     # Enable cronjobs in web server
```

**Default**: Both are disabled. Use separate CLI commands instead.

## Benefits of Separation

1. **Performance**: Web server isn't blocked by background processing
2. **Scalability**: Can run multiple queue workers on different servers
3. **Reliability**: One component failing doesn't affect others
4. **Monitoring**: Easier to monitor and restart individual components
5. **Resource Control**: Allocate resources per component

## Development Workflow

### Typical Development Setup
```bash
# Terminal 1: Web server with hot reload
bun run dev

# Terminal 2: Queue workers (when needed)
bun cli queue:work

# Terminal 3: Cronjobs (rarely needed in dev)
bun cli cronjobs:run
```

### Testing Without Background Processing
```bash
# Just run the web server
bun run dev
```

Queue jobs will accumulate in the database but won't be processed until you start the workers.

## Monitoring

### Check Queue Stats
```bash
# View pending jobs in database
sqlite3 data/ekv4.db "SELECT queue, status, COUNT(*) FROM jobs GROUP BY queue, status;"
```

### Check Logs
Each component logs independently:
- Web server: HTTP requests, route handling
- Queue workers: Job processing, ESI calls
- Cronjobs: Scheduled task execution

## Troubleshooting

### Queue workers not processing jobs
1. Check if `bun cli queue:work` is running
2. Check database for pending jobs
3. Review worker logs for errors

### Cronjobs not running
1. Check if `bun cli cronjobs:run` is running
2. Verify cronjob schedules in `/app/cronjobs/`
3. Check for cron syntax errors

### Web server slow
1. Make sure queue workers are running **separately**
2. Don't set `QUEUE_ENABLED=true` or `CRONJOBS_ENABLED=true`
3. Run workers in separate processes

## Migration Guide

If you previously ran everything together:

**Before:**
```bash
QUEUE_ENABLED=true CRONJOBS_ENABLED=true bun run dev
```

**After:**
```bash
# Terminal 1
bun run dev

# Terminal 2
bun cli queue:work

# Terminal 3
bun cli cronjobs:run
```
