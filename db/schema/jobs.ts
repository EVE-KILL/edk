import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Job identification
    queue: text("queue").notNull(), // e.g., "killmails", "esi", "stats"
    type: text("type").notNull(), // e.g., "process", "fetch", "update"

    // Job data
    payload: text("payload", { mode: "json" }).notNull(), // JSON data

    // Status tracking
    status: text("status").notNull().default("pending"),
    // pending -> processing -> completed/failed

    // Timing
    availableAt: integer("available_at", { mode: "timestamp" }).notNull(),
    // When job becomes available (for delayed jobs)

    reservedAt: integer("reserved_at", { mode: "timestamp" }),
    // When worker claimed the job

    processedAt: integer("processed_at", { mode: "timestamp" }),
    // When job finished (success or failure)

    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),

    // Retry logic
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),

    // Error tracking
    error: text("error"), // Last error message

    // Priority (lower = higher priority)
    priority: integer("priority").notNull().default(10),
  },
  (table) => ({
    // Composite index for efficient job fetching
    statusQueuePriorityIdx: index("status_queue_priority_idx").on(
      table.status,
      table.queue,
      table.priority,
      table.availableAt
    ),

    // Index for cleanup queries
    statusProcessedIdx: index("status_processed_idx").on(
      table.status,
      table.processedAt
    ),

    // Index for monitoring
    queueStatusIdx: index("queue_status_idx").on(table.queue, table.status),
  })
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
