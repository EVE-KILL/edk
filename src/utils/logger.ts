/**
 * Simple logger utility with levels and formatting
 * Replaces direct console.log calls for better control and consistency
 */

type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== "production";
    this.level = (process.env.LOG_LEVEL as LogLevel) || "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private format(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = this.isDevelopment ? "" : `[${timestamp}] `;

    switch (level) {
      case "debug":
        console.debug(`${prefix}🐛 ${message}`, ...args);
        break;
      case "info":
        console.log(`${prefix}${message}`, ...args);
        break;
      case "warn":
        console.warn(`${prefix}⚠️  ${message}`, ...args);
        break;
      case "error":
        console.error(`${prefix}❌ ${message}`, ...args);
        break;
    }
  }

  debug(message: string, ...args: any[]): void {
    this.format("debug", message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.format("info", message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.format("warn", message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.format("error", message, ...args);
  }

  // Convenience methods with emojis
  success(message: string, ...args: any[]): void {
    this.info(`✅ ${message}`, ...args);
  }

  loading(message: string, ...args: any[]): void {
    this.info(`🔄 ${message}`, ...args);
  }

  database(message: string, ...args: any[]): void {
    this.info(`📊 ${message}`, ...args);
  }

  cache(message: string, ...args: any[]): void {
    this.info(`📦 ${message}`, ...args);
  }

  server(message: string, ...args: any[]): void {
    this.info(`🚀 ${message}`, ...args);
  }

  route(message: string, ...args: any[]): void {
    this.debug(`🛣️  ${message}`, ...args);
  }

  queue(message: string, ...args: any[]): void {
    this.debug(`📝 ${message}`, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();
