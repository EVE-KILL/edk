import chalk from 'chalk';
import { logger } from '../helpers/logger';

export default defineEventHandler(async (event) => {
  const startTime = Date.now();

  // Extract request information
  const method = getMethod(event);
  const url = getRequestURL(event).pathname;
  const ip =
    (event.node.req.headers['x-forwarded-for'] as string) ||
    event.node.req.socket.remoteAddress ||
    '-';
  const userAgent = event.node.req.headers['user-agent'] || '-';

  // Wait for response using onAfterResponse hook
  event.node.res.on('finish', () => {
    const statusCode = event.node.res.statusCode;
    const duration = Date.now() - startTime;
    const responseSize = event.node.res.getHeader('content-length') || '0';

    // Color status codes
    let coloredStatus: string;
    if (statusCode >= 500) {
      coloredStatus = chalk.red(`${statusCode}`);
    } else if (statusCode >= 400) {
      coloredStatus = chalk.yellow(`${statusCode}`);
    } else if (statusCode >= 300) {
      coloredStatus = chalk.cyan(`${statusCode}`);
    } else {
      coloredStatus = chalk.green(`${statusCode}`);
    }

    const timestamp = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const methodColor = chalk.blue(method);
    const log = `${chalk.gray(timestamp)} ${methodColor} ${url} ${coloredStatus} ${chalk.gray(`${duration}ms`)} ${chalk.gray(`${responseSize}B`)} ${chalk.gray(ip)} ${chalk.magenta(userAgent)}`;

    logger.info(log);
  });
});
