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

    const pageHeader = {
      breadcrumbs: [
        { label: 'Home', url: '/' },
        { label: 'Status', url: '/status' },
      ],
      meta: [
        { type: 'pill', text: 'Live', class: 'status-pill-live' },
        {
          type: 'text',
          text: `Last updated ${new Date(snapshot.timestamp).toLocaleTimeString()}`,
          class: 'last-updated-text',
        },
        { type: 'button', text: 'Refresh', action: 'refresh' },
      ],
    };

    const data = {
      snapshot,
      pollIntervalSeconds: 5,
      pageHeader,
    };

    return await render('pages/status.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});
