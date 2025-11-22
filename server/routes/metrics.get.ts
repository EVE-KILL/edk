import { defineEventHandler, setHeader } from 'h3';
import { registry } from '~/helpers/metrics';

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', registry.contentType);
  return await registry.metrics();
});
