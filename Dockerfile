FROM oven/bun:alpine
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 3000
