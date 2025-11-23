# Services

The application is composed of several distinct services, each with a specific responsibility. These services run as separate processes and communicate with each other through the database, Redis, and the job queue.

## Web Server (Nitro)

-   **Entrypoint:** `bun dev`
-   **Description:** The primary web server, built with Nitro. It is responsible for handling all incoming HTTP requests, rendering HTML pages using Handlebars, and serving the REST API.
-   **Key Responsibilities:**
    -   Serving static assets.
    -   Rendering server-side HTML pages.
    -   Providing a JSON-based REST API for client-side interactions.
    -   Enqueuing jobs for background processing.

## WebSocket Server

-   **Entrypoint:** `bun ws`
-   **Description:** A dedicated WebSocket server that provides real-time communication between the server and connected clients.
-   **Key Responsibilities:**
    -   Pushing real-time updates to clients (e.g., new killmails).
    -   Handling client subscriptions to specific real-time data feeds.

## Queue Workers (BullMQ)

-   **Entrypoint:** `bun queue`
-   **Description:** A pool of worker processes that consume jobs from the BullMQ job queue. This service is responsible for handling all asynchronous and long-running tasks.
-   **Key Responsibilities:**
    -   Processing incoming killmails.
    -   Fetching data from the ESI API.
    -   Performing database updates and inserts.
    -   Updating the Typesense search index.

## Cron Jobs

-   **Entrypoint:** `bun cronjobs`
-   **Description:** A scheduler process that runs predefined tasks at specified intervals.
-   **Key Responsibilities:**
    -   Refreshing materialized views in the database.
    -   Performing periodic data cleanup.
    -   Running any other scheduled maintenance tasks.

## RedisQ Listener

-   **Entrypoint:** `bun cli listeners:redisq`
-   **Description:** A long-running process that listens to the zKillboard RedisQ feed for new killmails. This is the primary entry point for new killmail data into the system.
-   **Key Responsibilities:**
    -   Ingesting new killmails from the RedisQ feed.
    -   Enqueuing a job in BullMQ for each new killmail to be processed.
