import { collectStatusSnapshot } from '../helpers/status';
import { handleError } from '../utils/error';

export default defineEventHandler(async (event) => {
  try {
    setResponseHeaders(event, {
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Type': 'application/json',
    });

    const snapshot = await collectStatusSnapshot();
    return snapshot;
  } catch (error) {
    return handleError(event, error);
  }
});
