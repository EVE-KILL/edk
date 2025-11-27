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
    C -- Enqueues Jobs --> E
    D -- Real-time Updates --> A
    E -- Processes Killmails --> H
    E -- Updates Search Index --> J
    F -- Schedules Periodic Tasks --> E
    G -- Listens for and Enqueues Killmails --> E
    C -- Reads/Writes Data --> H
    C -- Caches Data --> I
    C -- Performs Searches --> J
```

## Data Flow

The data flow for a new killmail is designed to be asynchronous and resilient, ensuring that the application can handle a high volume of incoming data without impacting the user experience.

1.  **Ingestion:** The **RedisQ Listener** service continuously polls the zKillboard RedisQ feed for new killmails. When a new killmail is detected, it is immediately enqueued as a job in the **BullMQ** processing queue.

2.  **Processing:** A pool of **Queue Workers** listens for new jobs on the queue. When a new killmail job is available, a worker picks it up and begins processing. This involves:
    *   Fetching additional data from the ESI API, such as character and corporation details.
    *   Calculating the total value of the killmail.
    *   Formatting the data into a standardized format.

3.  **Storage:** The processed killmail data is then stored in the **PostgreSQL** database. This includes creating or updating records for the killmail itself, as well as any associated characters, corporations, and alliances.

4.  **Indexing:** Once the killmail has been successfully stored in the database, it is indexed in the **Typesense** search engine. This allows users to quickly and easily search for the killmail using a variety of criteria.

5.  **Real-time Notification:** The **WebSocket Server** sends a real-time update to all connected clients, notifying them of the new killmail. This allows the user interface to be updated in real-time, without the need for the user to refresh the page.

This asynchronous data flow ensures that the application remains responsive and performant, even when under heavy load.
