const DEFAULT_RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

export const rateLimitConfig = {
  '/api/killmail': {
    window: parseInt(
      process.env.RATE_LIMIT_KILLMAIL_WINDOW || `${DEFAULT_RATE_LIMIT_WINDOW}`,
      10
    ),
    max: parseInt(process.env.RATE_LIMIT_KILLMAIL_MAX || '50', 10),
  },
  '/api': {
    window: parseInt(
      process.env.RATE_LIMIT_DEFAULT_WINDOW || `${DEFAULT_RATE_LIMIT_WINDOW}`,
      10
    ),
    max: parseInt(
      process.env.RATE_LIMIT_DEFAULT_MAX ||
        `${DEFAULT_RATE_LIMIT_MAX_REQUESTS}`,
      10
    ),
  },
};
