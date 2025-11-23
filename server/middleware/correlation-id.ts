import { defineEventHandler, getHeader, setHeader } from 'h3';
import { randomUUID } from 'crypto';
import { als } from '../helpers/als';

export default defineEventHandler((event) => {
  const correlationId = getHeader(event, 'x-correlation-id') || randomUUID();

  setHeader(event, 'x-correlation-id', correlationId);

  return als.run({ correlationId }, () => {
    // This will run the next middleware/handler in the chain with the context
  });
});
