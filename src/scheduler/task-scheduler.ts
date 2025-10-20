import { eq, and, lte, desc, asc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { tasks, scheduledTaskRuns, type Task } from "../../db/schema/tasks";
import type { BaseTask } from "../../app/tasks/base-task";
import { TaskDiscovery } from "./task-discovery";
import { CronParser } from "./cron-parser";
import { logger } from "../utils/logger";

/**
 * Task Scheduler - Manages scheduled task execution
 *
 * Responsibilities:
 * - Load task definitions from database
 * - Discover task implementations from /app/tasks
 * - Evaluate cron schedules
 * - Execute tasks at scheduled times
 * - Track task execution history
 * - Handle manual task execution
 * - Graceful shutdown
 */
export class TaskScheduler {
  private taskInstances = new Map<string, BaseTask>();
  private taskClasses = new Map<string, typeof BaseTask>();
  private running = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private activeExecutions = 0;
  private pollIntervalMs = 10000; // Check every 10 seconds

  constructor(
    private db: BunSQLiteDatabase<any>,
    private cache: any
  ) {}

  /**
   * Initialize the scheduler
   * Loads task implementations from /app/tasks
   */
  async initialize() {
    logger.loading("Initializing task scheduler...");

    // Discover task implementations
    this.taskClasses = await TaskDiscovery.discoverTasks();

    if (this.taskClasses.size === 0) {
      logger.warn("No tasks discovered");
      return;
    }

    logger.success(`Loaded ${this.taskClasses.size} task implementation(s)`);
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.running) {
      logger.warn("Task scheduler already running");
      return;
    }

    if (this.taskClasses.size === 0) {
      logger.warn("Task scheduler has no tasks to run");
      return;
    }

    this.running = true;

    // Initialize task instances from database
    await this.loadTasksFromDatabase();

    // Start polling for scheduled tasks
    this.pollingInterval = setInterval(
      () => this.pollAndExecute(),
      this.pollIntervalMs
    );

    logger.success(`Task scheduler started with ${this.taskInstances.size} task(s)`);
  }

  /**
   * Stop the scheduler
   */
  async stop(timeout = 30000) {
    if (!this.running) {
      return;
    }

    logger.info("🛑 Stopping task scheduler...");
    this.running = false;

    // Stop polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Wait for active executions to finish
    await this.waitForActiveExecutions(timeout);

    logger.success("✅ Task scheduler stopped");
  }

  /**
   * Load tasks from database and instantiate them
   */
  private async loadTasksFromDatabase() {
    try {
      const taskRows = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.enabled, true));

      for (const taskRow of taskRows) {
        await this.instantiateTask(taskRow);
      }

      logger.success(`Initialized ${this.taskInstances.size} enabled task(s)`);
    } catch (error) {
      logger.error(
        `Failed to load tasks from database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Instantiate a task from its database record
   */
  private async instantiateTask(taskRow: Task) {
    const TaskClass = this.taskClasses.get(taskRow.module);

    if (!TaskClass) {
      logger.error(`Task implementation not found for module: ${taskRow.module}`);
      return;
    }

    try {
      const instance = new (TaskClass as any)(this.db, this.cache) as BaseTask;

      // Validate metadata
      const validation = instance.validateMetadata();
      if (!validation.valid) {
        logger.error(
          `Task validation failed for ${taskRow.name}: ${validation.errors.join(", ")}`
        );
        return;
      }

      this.taskInstances.set(taskRow.name, instance);
      logger.info(`Initialized task: ${taskRow.name}`);
    } catch (error) {
      logger.error(
        `Failed to instantiate task ${taskRow.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Poll for tasks to execute
   */
  private async pollAndExecute() {
    if (!this.running || this.taskInstances.size === 0) {
      return;
    }

    const now = new Date();

    // Find tasks that should run
    try {
      const dueTasks = await this.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.enabled, true),
            lte(tasks.nextScheduledAt, now)
          )
        );

      for (const taskRow of dueTasks) {
        // Check concurrency
        const activeRuns = await this.countActiveRuns(taskRow.id);
        if (activeRuns >= taskRow.maxConcurrent) {
          logger.warn(
            `Task ${taskRow.name} at max concurrency (${taskRow.maxConcurrent}), skipping execution`
          );
          continue;
        }

        // Execute task
        await this.executeTask(taskRow, "schedule");
      }
    } catch (error) {
      logger.error(
        `Error polling for tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a task
   */
  async executeTask(
    taskRow: Task,
    triggeredBy: "schedule" | "manual" = "manual",
    triggeredByUser?: string
  ) {
    const taskInstance = this.taskInstances.get(taskRow.name);

    if (!taskInstance) {
      logger.error(`Task instance not found: ${taskRow.name}`);
      return;
    }

    this.activeExecutions++;

    // Create run record
    const runId = await this.createRunRecord(taskRow.id, triggeredBy, triggeredByUser);

    const startTime = Date.now();
    let result;

    try {
      logger.info(`Executing task: ${taskRow.name}`);

      // Call before hook
      await taskInstance.beforeExecute();

      // Execute with timeout
      result = await Promise.race([
        taskInstance.execute(),
        this.createTimeout(taskRow.timeout),
      ]) as any;

      logger.success(`Task completed: ${taskRow.name}`);
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      logger.error(`Task failed: ${taskRow.name} - ${result.error}`);
    }

    const duration = Date.now() - startTime;

    try {
      // Call after hook
      await taskInstance.afterExecute(result);

      // Update run record
      await this.updateRunRecord(runId, result, duration);

      // Update task record
      await this.updateTaskRecord(taskRow.id, result, duration);
    } catch (error) {
      logger.error(
        `Error updating task records: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.activeExecutions--;
  }

  /**
   * Create a scheduled task run record
   */
  private async createRunRecord(
    taskId: number,
    triggeredBy: "schedule" | "manual",
    triggeredByUser?: string
  ): Promise<number> {
    const now = new Date();
    await this.db.insert(scheduledTaskRuns).values({
      taskId,
      status: "running",
      startedAt: now,
      triggeredBy,
      triggeredByUser,
      createdAt: now,
    });

    // Get the last inserted ID by querying the most recent record
    const result = await this.db
      .select()
      .from(scheduledTaskRuns)
      .orderBy(desc(scheduledTaskRuns.id))
      .limit(1);

    return result[0]?.id || 0;
  }

  /**
   * Update run record with result
   */
  private async updateRunRecord(
    runId: number,
    result: any,
    duration: number
  ) {
    const now = new Date();
    await this.db
      .update(scheduledTaskRuns)
      .set({
        status: result.success ? "completed" : "failed",
        completedAt: now,
        durationMs: duration,
        output: result.success ? result.data : null,
        error: result.error || null,
      })
      .where(eq(scheduledTaskRuns.id, runId));
  }

  /**
   * Update task record with execution stats
   */
  private async updateTaskRecord(taskId: number, result: any, duration: number) {
    const now = new Date();
    const taskRows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    const taskRow = taskRows[0];
    if (!taskRow) return;

    // Calculate next scheduled time
    let nextScheduledAt: Date | null = null;
    if (taskRow.schedule) {
      try {
        const cronParser = new CronParser(taskRow.schedule);
        nextScheduledAt = cronParser.getNextExecution(now);
      } catch (error) {
        logger.error(`Failed to calculate next execution: ${error}`);
      }
    }

    await this.db
      .update(tasks)
      .set({
        lastRunAt: now,
        lastCompletedAt: result.success ? now : taskRow.lastCompletedAt,
        lastFailureAt: result.success ? taskRow.lastFailureAt : now,
        nextScheduledAt,
        totalRuns: taskRow.totalRuns + 1,
        successfulRuns: result.success ? taskRow.successfulRuns + 1 : taskRow.successfulRuns,
        failedRuns: result.success ? taskRow.failedRuns : taskRow.failedRuns + 1,
        lastError: result.error || null,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));
  }

  /**
   * Count active runs for a task
   */
  private async countActiveRuns(taskId: number): Promise<number> {
    const result = await this.db
      .select()
      .from(scheduledTaskRuns)
      .where(
        and(
          eq(scheduledTaskRuns.taskId, taskId),
          eq(scheduledTaskRuns.status, "running")
        )
      );
    return result.length;
  }

  /**
   * Get task by name
   */
  getTask(name: string): Task | null {
    // Would need to fetch from DB - for now return null
    // This is used by API routes
    return null;
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<Task[]> {
    return await this.db
      .select()
      .from(tasks)
      .orderBy(asc(tasks.name));
  }

  /**
   * Get task execution history
   */
  async getTaskHistory(taskId: number, limit = 50): Promise<any[]> {
    return await this.db
      .select()
      .from(scheduledTaskRuns)
      .where(eq(scheduledTaskRuns.taskId, taskId))
      .orderBy(desc(scheduledTaskRuns.createdAt))
      .limit(limit);
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Wait for active executions to finish
   */
  private async waitForActiveExecutions(timeout: number) {
    const startTime = Date.now();

    while (this.activeExecutions > 0) {
      if (Date.now() - startTime > timeout) {
        logger.warn(`Force stopping task scheduler with ${this.activeExecutions} active task(s)`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
