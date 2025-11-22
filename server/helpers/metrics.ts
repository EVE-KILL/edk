import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const registry = new Registry();

export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

export const httpRequestDurationHistogram = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const dbQueryDurationHistogram = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [registry],
});

export const activeConnectionsGauge = new Gauge({
  name: 'database_active_connections',
  help: 'Number of active database connections',
  registers: [registry],
});
