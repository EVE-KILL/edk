import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Task identification
    name: text("name").notNull().unique(), // e.g., "cleanup-cache", "fetch-esi-data"
    description: text("description"), // Human-readable description

    // Scheduling
    schedule: text("schedule"), // Cron expression: "*/5 * * * *" for every 5 minutes
    // null = manual execution only
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

    // Metadata
    module: text("module").notNull(), // Path to task module: "tasks/cleanup-cache.ts"
    tags: text("tags"), // Comma-separated tags for categorization
    timeout: integer("timeout").notNull().default(30000), // Task timeout in milliseconds
    maxConcurrent: integer("max_concurrent").notNull().default(1), // Max concurrent executions

    // Timing
    lastRunAt: integer("last_run_at", { mode: "timestamp" }),
    lastCompletedAt: integer("last_completed_at", { mode: "timestamp" }),
    lastFailureAt: integer("last_failure_at", { mode: "timestamp" }),
    nextScheduledAt: integer("next_scheduled_at", { mode: "timestamp" }),

    // Statistics
    totalRuns: integer("total_runs").notNull().default(0),
    successfulRuns: integer("successful_runs").notNull().default(0),
    failedRuns: integer("failed_runs").notNull().default(0),

    // Error tracking
    lastError: text("last_error"),

    // Audit
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // Efficient scheduling queries
    enabledScheduleIdx: index("enabled_schedule_idx").on(
      table.enabled,
      table.schedule,
      table.nextScheduledAt
    ),

    // Find tasks by name
    nameIdx: index("tasks_name_idx").on(table.name),

    // Find tasks by tags
    tagsIdx: index("tasks_tags_idx").on(table.tags),
  })
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

/**
 * Scheduled task run history for auditing and monitoring
 */
export const scheduledTaskRuns = sqliteTable(
  "scheduled_task_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Reference to task
    taskId: integer("task_id").notNull(),

    // Run metadata
    status: text("status").notNull(), // "pending", "running", "completed", "failed"
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),

    // Performance
    durationMs: integer("duration_ms"), // Execution time in milliseconds

    // Result
    output: text("output", { mode: "json" }), // Task output/result
    error: text("error"), // Error message if failed

    // Tracking
    triggeredBy: text("triggered_by").notNull(), // "schedule" or "manual"
    triggeredByUser: text("triggered_by_user"), // User token/identifier if manual

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // Find runs for a specific task
    taskIdIdx: index("task_id_idx").on(table.taskId),

    // Find recent runs
    createdAtIdx: index("run_created_at_idx").on(table.createdAt),

    // Find failed runs
    statusIdx: index("run_status_idx").on(table.status),
  })
);

export type ScheduledTaskRun = typeof scheduledTaskRuns.$inferSelect;
export type NewScheduledTaskRun = typeof scheduledTaskRuns.$inferInsert;
