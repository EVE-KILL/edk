# Architecture Overview

This document provides a high-level overview of the EVE-KILL application architecture.

## System Design Philosophy

The system is designed to be a high-performance, self-hosted EVE Online killboard. It is built with a modern technology stack that prioritizes speed and efficiency. The architecture is modular, separating concerns into distinct components to improve maintainability and scalability.

## Core Technologies

-   **Bun:** A fast JavaScript runtime, bundler, and package manager used as the foundation for the entire application.
-   **Nitro:** A lightweight, high-performance web framework used for the server-side application, including API routes and server-side rendering.
-   **PostgreSQL:** The primary relational database used for storing all persistent data, such as killmails, characters, and corporations.
-   **Redis:** An in-memory data store used for caching and as the backbone for the background job queueing system.
-   **BullMQ:** A robust and efficient job queue system built on top of Redis, used for handling asynchronous tasks like processing killmails.
-   **Typesense:** A fast, typo-tolerant search engine used for providing powerful search capabilities across the application.
-   **Handlebars:** A templating engine used for server-side rendering of HTML pages.

## System Architecture Diagram

```mermaid
graph TD
    subgraph "User Interface"
        A[Browser]
    end

    subgraph "Application Server (Nitro)"
        B[Web Server]
        C[API Routes]
        D[WebSocket Server]
    end

    subgraph "Background Services"
        E[Queue Workers (BullMQ)]
        F[Cron Jobs]
        G[RedisQ Listener]
    end

    subgraph "Data Stores"
        H[PostgreSQL]
        I[Redis]
        J[Typesense]
    end

    A -- HTTP/WebSocket --> B
    B -- Renders HTML --> A
    A -- API Calls --> C
    C -- Jobs --> E
    D -- Real-time Updates --> A
    E -- Processes Jobs --> H
    E -- Processes Jobs --> J
    F -- Scheduled Tasks --> E
    G -- Ingests Killmails --> E
    C -- Reads/Writes --> H
    C -- Caches Data --> I
    C -- Searches --> J
```

*TODO: This diagram will be replaced with a more detailed and polished version.*

## Data Flow

A typical data flow for a new killmail looks like this:

1.  The **RedisQ Listener** ingests a new killmail from the zKillboard RedisQ feed.
2.  The listener enqueues a job in **BullMQ** to process the killmail.
3.  A **Queue Worker** picks up the job and processes the killmail data, fetching additional details from the ESI API if necessary.
4.  The processed killmail data is stored in the **PostgreSQL** database.
5.  The data is also indexed in the **Typesense** search engine.
6.  The **WebSocket Server** sends a real-time update to any connected clients to notify them of the new killmail.
7.  A user can then view the killmail in their **Browser**, which is rendered by the **Web Server**.

*TODO: A more detailed data flow diagram will be added here.*
