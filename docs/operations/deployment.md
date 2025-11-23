# Deployment Guide

This guide provides a basic overview of how to deploy the EVE-KILL application in a production environment.

**Note:** This guide is a work in progress and will be expanded upon in the future.

## Prerequisites

-   A server with Docker and Docker Compose installed.
-   A PostgreSQL database.
-   A Redis instance.
-   A Typesense instance.

## Building the Application

1.  **Build the Nitro server:**

    ```bash
    bun run build
    ```

    This will create a production-ready build of the Nitro server in the `.output/` directory.

## Running the Application

1.  **Copy the build output:**

    Copy the `.output/` directory to your production server.

2.  **Set up environment variables:**

    Create a `.env` file on your production server with the necessary environment variables for connecting to your database, Redis, and Typesense instances.

3.  **Run the server:**

    ```bash
    node .output/server/index.mjs
    ```

    This will start the Nitro server in production mode.

## Running the Other Services

You will also need to run the other services (WebSocket server, queue workers, cron jobs, and RedisQ listener) in production. You can do this by running the following commands:

```bash
bun ws
bun queue
bun cronjobs
bun cli listeners:redisq
```

It is recommended to use a process manager like `pm2` or `systemd` to manage these long-running processes.

## Docker Compose (Recommended)

For a more robust and manageable deployment, it is recommended to use the provided `docker-compose.yml` file to run the application and its services in containers. You will need to build a custom Docker image for the application and then configure Docker Compose to use that image.

*TODO: Provide a `Dockerfile` and more detailed instructions for a Docker-based deployment.*
