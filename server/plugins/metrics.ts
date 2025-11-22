import {
  httpRequestCounter,
  httpRequestDurationHistogram,
} from '~/server/helpers/metrics';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const start = Date.now();
    event.context.metrics = { start };
  });

  nitroApp.hooks.hook('afterResponse', (event) => {
    const { start } = event.context.metrics;
    const duration = (Date.now() - start) / 1000;
    const path = event.node.req.url || '/';
    const method = event.node.req.method || 'GET';
    const status = event.node.res.statusCode || 500;

    httpRequestCounter.inc({ method, path, status });
    httpRequestDurationHistogram.observe({ method, path, status }, duration);
  });
});
