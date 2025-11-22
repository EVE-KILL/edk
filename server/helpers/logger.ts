import chalk from 'chalk';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

interface LogContext {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: Record<string, any>;
}

function formatTimestamp(date: Date): string {
  return chalk.gray(
    date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  );
}

function getLevelColor(level: LogLevel): string {
  switch (level) {
    case 'info':
      return chalk.cyan('[INFO]');
    case 'warn':
      return chalk.yellow('[WARN]');
    case 'error':
      return chalk.red('[ERROR]');
    case 'debug':
      return chalk.gray('[DEBUG]');
    case 'success':
      return chalk.green('[✓]');
    default:
      return chalk.cyan('[LOG]');
  }
}

function formatData(data: Record<string, any>): string {
  const replacer = (_key: any, value: any) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  };
  return '\n  ' + JSON.stringify(data, replacer, 2).split('\n').join('\n  ');
}

function log(context: LogContext): void {
  const { level, message, timestamp, data } = context;
  const levelTag = getLevelColor(level);
  const time = formatTimestamp(timestamp);
  const msg = level === 'error' ? chalk.red(message) : message;

  let output = `${time} ${levelTag} ${msg}`;

  if (data && Object.keys(data).length > 0) {
    output += formatData(data);
  }

  console.log(output);
}

export const logger = {
  info: (message: string, data?: Record<string, any>) => {
    log({ level: 'info', message, timestamp: new Date(), data });
  },

  warn: (message: string, data?: Record<string, any>) => {
    log({ level: 'warn', message, timestamp: new Date(), data });
  },

  error: (message: string, data?: Record<string, any>) => {
    log({ level: 'error', message, timestamp: new Date(), data });
  },

  debug: (message: string, data?: Record<string, any>) => {
    log({ level: 'debug', message, timestamp: new Date(), data });
  },

  success: (message: string, data?: Record<string, any>) => {
    log({ level: 'success', message, timestamp: new Date(), data });
  },
};
