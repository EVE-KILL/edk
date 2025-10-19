import type { Job } from "../schema/jobs";

/**
 * Base class for all queue workers
 *
 * Extend this class to create custom workers for different queue types.
 *
 * @example
 * ```typescript
 * export class MyWorker extends BaseWorker<MyPayloadType> {
 *   queueName = "my-queue";
 *   concurrency = 5;
 *   pollInterval = 1000;
 *
 *   async handle(payload: MyPayloadType, job: Job) {
 *     // Do work here
 *   }
 * }
 * ```
 */
export abstract class BaseWorker<TPayload = any> {
  /**
   * The name of the queue this worker processes
   * Must be unique across all workers
   */
  abstract queueName: string;

  /**
   * How often to poll for new jobs (in milliseconds)
   * Default: 1000ms (1 second)
   *
   * - Fast jobs (ESI fetches): 100-500ms
   * - Normal jobs (killmail processing): 1000ms
   * - Slow jobs (statistics): 5000ms
   */
  pollInterval = 1000;

  /**
   * How many jobs to process in parallel
   * Default: 1 (serial processing)
   *
   * - I/O-bound (ESI): High concurrency (10-50)
   * - Database-bound: Medium concurrency (3-10)
   * - CPU-bound: Low concurrency (1-2)
   */
  concurrency = 1;

  /**
   * Process a single job
   *
   * @param payload The job payload (automatically parsed from JSON)
   * @param job The full job record (contains metadata like attempts, createdAt, etc.)
   *
   * @throws Error if job processing fails (will trigger retry logic)
   */
  abstract handle(payload: TPayload, job: Job): Promise<void>;

  /**
   * Optional: Called when worker is registered
   * Use for initialization (e.g., connecting to external services)
   */
  async onRegister?(): Promise<void>;

  /**
   * Optional: Called when queue manager is stopping
   * Use for cleanup (e.g., closing connections)
   */
  async onStop?(): Promise<void>;
}
