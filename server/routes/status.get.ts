import type { H3Event } from 'h3';
import { collectStatusSnapshot } from '../helpers/status';
import { render } from '../helpers/templates';
import { handleError } from '../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const snapshot = await collectStatusSnapshot();

    const pageContext = {
      title: 'Status',
      description: 'Live system status for database, queues, and services.',
    };

    const data = {
      snapshot,
      pollIntervalSeconds: 5,
    };

    return await render('pages/status.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});
