# Dockerfile for EVE-KILL EDK
# Single-stage build that copies source 1:1 and builds Nitro in-place

FROM oven/bun:alpine
WORKDIR /app

# Copy entire application 1:1
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

# Build the Nitro application (creates .output directory)
RUN bun run build

# Set environment variable to indicate container environment
ENV NODE_ENV=production
ENV EDK_CONTAINER=true

# Expose the application port
EXPOSE 3000

# Default command runs the Nitro server
# Can be overridden for queue/cron/ws/cli workers
CMD ["bun", "--bun", ".output/server/index.mjs"]
