import { logger } from "../utils/logger";

/**
 * Cronjob result metadata
 */
export interface CronjobResult {
  success: boolean;
  message?: string;
  error?: string;
  duration?: number; // milliseconds
}

/**
 * Cronjob metadata
 */
export interface CronjobMetadata {
  name: string;
  description: string;
  schedule: string; // cron expression: "0 0 * * *" (daily at midnight), "*/5 * * * *" (every 5 min), etc.
  timeout?: number; // milliseconds, default 5 minutes
}

/**
 * Base class for all cronjobs
 * Extend this to create new scheduled tasks
 *
 * @example
 * export class CleanupTask extends BaseCronjob {
 *   metadata = {
 *     name: "cleanup",
 *     description: "Clean old data",
 *     schedule: "0 0 * * *" // Daily at midnight
 *   };
 *
 *   async execute(): Promise<CronjobResult> {
 *     // Your task code here
 *     return { success: true, message: "Cleanup complete" };
 *   }
 * }
 */
export abstract class BaseCronjob {
  abstract metadata: CronjobMetadata;

  /**
   * Execute the cronjob
   * Implement this in subclasses
   */
  abstract execute(): Promise<CronjobResult>;

  /**
   * Helper: log info message
   */
  protected info(message: string): void {
    logger.info(`[${this.metadata.name}] ${message}`);
  }

  /**
   * Helper: log error message
   */
  protected error(message: string): void {
    logger.error(`[${this.metadata.name}] ${message}`);
  }

  /**
   * Helper: log warning message
   */
  protected warn(message: string): void {
    logger.warn(`[${this.metadata.name}] ${message}`);
  }
}
