import { eq, and, or, lt, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { jobs, type Job, type NewJob } from "../../db/schema/jobs";

/**
 * Job Dispatcher - Enqueue and manage jobs
 *
 * Provides methods to:
 * - Enqueue single or multiple jobs
 * - Get queue statistics
 * - Cleanup old jobs
 */
export class JobDispatcher {
  constructor(private db: BunSQLiteDatabase<any>) {}

  /**
   * Enqueue a single job
   *
   * @example
   * ```typescript
   * await queue.dispatch("killmails", "process", {
   *   killmailId: 100001,
   *   data: killmailData
   * });
   * ```
   */
  async dispatch<TPayload = any>(
    queue: string,
    type: string,
    payload: TPayload,
    options: {
      priority?: number; // Lower = higher priority (default: 0)
      delay?: number; // Delay in seconds (default: 0)
      maxAttempts?: number; // Max retry attempts (default: 3)
    } = {}
  ): Promise<Job> {
    const now = new Date();
    const availableAt = options.delay
      ? new Date(now.getTime() + options.delay * 1000)
      : now;

    const [job] = await this.db
      .insert(jobs)
      .values({
        queue,
        type,
        payload: payload as any,
        status: "pending",
        availableAt,
        createdAt: now,
        attempts: 0,
        maxAttempts: options.maxAttempts ?? 3,
        priority: options.priority ?? 0,
      })
      .returning();

    return job;
  }

  /**
   * Enqueue multiple jobs at once (more efficient than calling dispatch() repeatedly)
   *
   * @example
   * ```typescript
   * await queue.dispatchMany("esi", "fetch",
   *   characterIds.map(id => ({ type: "character", id }))
   * );
   * ```
   */
  async dispatchMany<TPayload = any>(
    queue: string,
    type: string,
    payloads: TPayload[],
    options: {
      priority?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<Job[]> {
    if (payloads.length === 0) {
      return [];
    }

    const now = new Date();

    return await this.db
      .insert(jobs)
      .values(
        payloads.map((payload) => ({
          queue,
          type,
          payload: payload as any,
          status: "pending" as const,
          availableAt: now,
          createdAt: now,
          attempts: 0,
          maxAttempts: options.maxAttempts ?? 3,
          priority: options.priority ?? 0,
        }))
      )
      .returning();
  }

  /**
   * Get statistics for a specific queue or all queues
   *
   * @example
   * ```typescript
   * // All queues
   * const stats = await queue.getStats();
   * // { pending: 42, processing: 5, completed: 1234, failed: 3 }
   *
   * // Specific queue
   * const killmailStats = await queue.getStats("killmails");
   * ```
   */
  async getStats(queue?: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const where = queue ? eq(jobs.queue, queue) : undefined;

    const stats = await this.db
      .select({
        status: jobs.status,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .where(where)
      .groupBy(jobs.status);

    return {
      pending: stats.find((s) => s.status === "pending")?.count ?? 0,
      processing: stats.find((s) => s.status === "processing")?.count ?? 0,
      completed: stats.find((s) => s.status === "completed")?.count ?? 0,
      failed: stats.find((s) => s.status === "failed")?.count ?? 0,
    };
  }

  /**
   * Get detailed statistics for all queues
   *
   * @returns Object with stats per queue name
   */
  async getStatsByQueue(): Promise<
    Record<
      string,
      {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
      }
    >
  > {
    const stats = await this.db
      .select({
        queue: jobs.queue,
        status: jobs.status,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .groupBy(jobs.queue, jobs.status);

    const result: Record<string, any> = {};

    for (const stat of stats) {
      if (!result[stat.queue]) {
        result[stat.queue] = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        };
      }
      result[stat.queue][stat.status] = stat.count;
    }

    return result;
  }

  /**
   * Get list of failed jobs for inspection
   *
   * @param limit Maximum number of failed jobs to return
   */
  async getFailedJobs(limit = 50): Promise<Job[]> {
    return await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "failed"))
      .orderBy(sql`${jobs.processedAt} DESC`)
      .limit(limit);
  }

  /**
   * Retry a specific failed job
   *
   * @param jobId The job ID to retry
   */
  async retryJob(jobId: number): Promise<void> {
    await this.db
      .update(jobs)
      .set({
        status: "pending",
        attempts: 0,
        error: null,
        availableAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }

  /**
   * Retry all failed jobs for a specific queue
   *
   * @param queue Queue name (optional - if not provided, retries all failed jobs)
   */
  async retryAllFailed(queue?: string): Promise<number> {
    const where = queue
      ? and(eq(jobs.status, "failed"), eq(jobs.queue, queue))
      : eq(jobs.status, "failed");

    const result: any = await this.db
      .update(jobs)
      .set({
        status: "pending",
        attempts: 0,
        error: null,
        availableAt: new Date(),
      })
      .where(where);

    return result.changes || 0;
  }

  /**
   * Delete old completed/failed jobs
   *
   * @param olderThanDays Jobs older than this many days will be deleted
   * @returns Number of jobs deleted
   *
   * @example
   * ```typescript
   * // Delete jobs older than 7 days
   * const deleted = await queue.cleanup(7);
   * console.log(`Deleted ${deleted} old jobs`);
   * ```
   */
  async cleanup(olderThanDays = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result: any = await this.db
      .delete(jobs)
      .where(
        and(
          or(eq(jobs.status, "completed"), eq(jobs.status, "failed")),
          lt(jobs.processedAt, cutoff)
        )
      );

    return result.changes || 0;
  }

  /**
   * Delete all jobs for a specific queue (useful for testing)
   *
   * @param queue Queue name
   * @param onlyCompleted If true, only delete completed/failed jobs
   */
  async purgeQueue(queue: string, onlyCompleted = true): Promise<number> {
    const where = onlyCompleted
      ? and(
          eq(jobs.queue, queue),
          or(eq(jobs.status, "completed"), eq(jobs.status, "failed"))
        )
      : eq(jobs.queue, queue);

    const result: any = await this.db.delete(jobs).where(where);

    return result.changes || 0;
  }

  /**
   * Get the total count of jobs
   *
   * @param queue Optional queue name to filter by
   */
  async count(queue?: string): Promise<number> {
    const where = queue ? eq(jobs.queue, queue) : undefined;

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(where);

    return result.count;
  }
}

// Create singleton instance
import { DatabaseConnection } from "../db";
export const queue = new JobDispatcher(DatabaseConnection.getQueueInstance());
