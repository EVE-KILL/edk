# Stage 1: Install all dependencies
FROM oven/bun:1 as deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build the application
FROM deps as build
WORKDIR /app
COPY . .
RUN bun run build

# Stage 3: Production image
FROM oven/bun:1 as production
WORKDIR /app

# Copy production dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy built artifacts from the build stage
COPY --from=build /app/.output ./.output

# Expose port and start the application
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
