/**
 * Simple cron expression parser
 *
 * Supports the standard 5-field cron format:
 * (minute hour day month day-of-week)
 *
 * Examples:
 * Every 5 minutes: (star)/5 (star) (star) (star) (star)
 * Every 6 hours: 0 (star)/6 (star) (star) (star)
 * Every day at midnight: 0 0 (star) (star) (star)
 * First day of month: 0 0 1 (star) (star)
 * Weekdays at 9 AM: 0 9 (star) (star) 1-5
 */

interface CronParts {
  minute: number[];
  hour: number[];
  day: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Parse a cron expression and check if it matches the current time
 */
export class CronParser {
  private parts: CronParts;

  constructor(cronExpression: string) {
    this.parts = CronParser.parse(cronExpression);
  }

  /**
   * Check if the cron expression matches the given date/time
   */
  matches(date: Date = new Date()): boolean {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    return (
      this.parts.minute.includes(minute) &&
      this.parts.hour.includes(hour) &&
      (this.parts.day.includes(day) || this.parts.dayOfWeek.includes(dayOfWeek)) &&
      this.parts.month.includes(month)
    );
  }

  /**
   * Calculate the next execution time after the given date
   */
  getNextExecution(afterDate: Date = new Date()): Date {
    // Start checking from the next minute
    let date = new Date(afterDate);
    date.setSeconds(0);
    date.setMilliseconds(0);
    date.setMinutes(date.getMinutes() + 1);

    // Limit iterations to prevent infinite loops (max 4 weeks)
    const maxIterations = 4 * 7 * 24 * 60;
    let iterations = 0;

    while (iterations < maxIterations) {
      if (this.matches(date)) {
        return date;
      }

      // Increment by minute
      date.setMinutes(date.getMinutes() + 1);
      iterations++;
    }

    throw new Error(`Could not find next execution time for cron: ${this.toString()}`);
  }

  /**
   * Parse a cron expression into its components
   */
  private static parse(cronExpression: string): CronParts {
    const fields = cronExpression.trim().split(/\s+/);

    if (fields.length !== 5) {
      throw new Error(
        `Invalid cron expression: expected 5 fields, got ${fields.length}`
      );
    }

    return {
      minute: CronParser.parseField(fields[0]!, 0, 59),
      hour: CronParser.parseField(fields[1]!, 0, 23),
      day: CronParser.parseField(fields[2]!, 1, 31),
      month: CronParser.parseField(fields[3]!, 1, 12),
      dayOfWeek: CronParser.parseField(fields[4]!, 0, 6),
    };
  }

  /**
   * Parse a single cron field
   * Supports: * / , -
   */
  private static parseField(
    field: string,
    min: number,
    max: number
  ): number[] {
    // Wildcard - all values
    if (field === "*") {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }

    const values: Set<number> = new Set();

    // Handle comma-separated values
    const parts = field.split(",");

    for (const part of parts) {
      // Handle ranges with step (e.g., "*/5", "1-30/2")
      if (part.includes("/")) {
        const [rangePart, step] = part.split("/");
        if (!rangePart || !step) {
          throw new Error(`Invalid range/step format: ${part}`);
        }
        const stepNum = parseInt(step);

        if (isNaN(stepNum) || stepNum <= 0) {
          throw new Error(`Invalid step value: ${step}`);
        }

        let start: number, end: number;

        if (rangePart === "*") {
          start = min;
          end = max;
        } else if (rangePart.includes("-")) {
          [start, end] = CronParser.parseRange(rangePart, min, max);
        } else {
          start = parseInt(rangePart);
          end = max;
        }

        for (let i = start; i <= end; i += stepNum) {
          values.add(i);
        }
      }
      // Handle ranges (e.g., "1-5")
      else if (part.includes("-")) {
        const [start, end] = CronParser.parseRange(part, min, max);
        for (let i = start; i <= end; i++) {
          values.add(i);
        }
      }
      // Handle single values
      else {
        const num = parseInt(part);
        if (isNaN(num) || num < min || num > max) {
          throw new Error(
            `Value ${part} out of range [${min}, ${max}]`
          );
        }
        values.add(num);
      }
    }

    return Array.from(values).sort((a, b) => a - b);
  }

  /**
   * Parse a range (e.g., "1-5")
   */
  private static parseRange(range: string, min: number, max: number): [number, number] {
    const parts = range.split("-");
    if (parts.length < 2) throw new Error(`Invalid range: ${range}`);
    const startStr = parts[0];
    const endStr = parts[1];
    if (startStr === undefined || endStr === undefined) {
       throw new Error(`Invalid range: ${range}`);
    }

    const start = parseInt(startStr);
    const end = parseInt(endStr);

    if (isNaN(start) || isNaN(end)) {
      throw new Error(`Invalid range: ${range}`);
    }

    if (start > end) {
      throw new Error(`Invalid range: start ${start} is greater than end ${end}`);
    }

    if (start < min || end > max) {
      throw new Error(`Range [${start}, ${end}] out of bounds [${min}, ${max}]`);
    }

    return [start, end];
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `CronParser(${JSON.stringify(this.parts)})`;
  }
}
