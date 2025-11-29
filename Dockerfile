# Dockerfile for EVE-KILL EDK
# Multi-stage build that preserves source for CLI/queue/cron/ws workers

# Build stage
FROM oven/bun:alpine AS builder
WORKDIR /build

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Build the Nitro application
RUN bun run build

# Production stage
FROM oven/bun:alpine
WORKDIR /app

# Copy package files and install production dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy built Nitro output from builder
COPY --from=builder /build/.output /app/.output

# Copy source files needed for CLI, queue, cron, and websocket workers
COPY cli.ts cronjobs.ts queue.ts ws.ts ./
COPY commands ./commands
COPY cronjobs ./cronjobs
COPY queue ./queue
COPY ws ./ws
COPY db ./db
COPY server ./server
COPY templates ./templates

# Set environment variable to indicate container environment
ENV NODE_ENV=production
ENV EDK_CONTAINER=true

# Expose the application port
EXPOSE 3000

# Default command runs the Nitro server
# Can be overridden for queue/cron/ws/cli workers
CMD ["bun", "--bun", "run", ".output/server/index.mjs"]
