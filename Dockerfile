# Dockerfile for EVE-KILL

# --- 1. Builder Stage ---
FROM oven/bun:1.0 as builder

WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the application
RUN bun run build


# --- 2. Runner Stage ---
FROM oven/bun:1.0-slim as runner

WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install production dependencies
RUN bun install --frozen-lockfile --production

# Copy the build output from the builder stage
COPY --from=builder /app/.output ./.output

# Expose the port the application runs on
EXPOSE 3000

# Set the command to run the application
CMD ["node", ".output/server/index.mjs"]
