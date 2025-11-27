# Deployment Guide

This guide provides a comprehensive overview of how to deploy the EVE-KILL application in a production environment using Docker Compose.

## Prerequisites

-   A server with Docker and Docker Compose installed.
-   A configured `.env` file with your production settings.

## Docker-Based Deployment (Recommended)

The recommended way to deploy EVE-KILL is by using Docker and the provided `docker-compose.prod.yml` file. This method ensures that all components of the application are run in a consistent and isolated environment.

### 1. Build the Docker Image

First, you need to build the Docker image for the application. This image will contain the production-ready build of the Nitro server and all the necessary dependencies.

```bash
docker build -t eve-kill .
```

### 2. Configure Production Environment

Copy the `docker-compose.prod.yml` file to your production server. You will also need to create a `.env` file with the production-specific environment variables.

```bash
cp .env.example .env
```

Make sure to update the `.env` file with the correct values for your production environment.

### 3. Run the Application with Docker Compose

Once you have built the Docker image and configured the environment, you can run the application using Docker Compose.

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This command will start all the services defined in the `docker-compose.prod.yml` file in detached mode. This includes the main application server, as well as the WebSocket server, queue workers, cron jobs, and RedisQ listener.

## Manual Deployment

While not recommended for production, you can also deploy the application manually without using Docker.

### 1. Build the Application

First, you need to build the Nitro server:

```bash
bun run build
```

This will create a production-ready build of the Nitro server in the `.output/` directory.

### 2. Run the Application

Copy the `.output/` directory to your production server and create a `.env` file with the necessary environment variables. Then, you can run the server:

```bash
node .output/server/index.mjs
```

### 3. Run Other Services

You will also need to run the other services in separate processes:

```bash
bun ws
bun queue
bun cronjobs
bun cli listeners:redisq
```

It is highly recommended to use a process manager like `pm2` or `systemd` to manage these long-running processes.
