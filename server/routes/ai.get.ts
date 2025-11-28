import type { H3Event } from 'h3';

export default defineEventHandler(async (event: H3Event) => {
  const pageContext = {
    title: 'AI Assistant',
    description:
      'Chat with the EVE-KILL AI assistant to find killmails using natural language',
    keywords: 'eve online, ai, assistant, killmail search, natural language',
    url: '/ai',
    additionalCSS: ['/css/ai-page.css'],
  };

  const data = {
    pageHeader: {
      title: 'AI Assistant',
      breadcrumbs: [
        { label: 'Home', url: '/' },
        { label: 'AI Assistant', url: '/ai' },
      ],
      meta: [
        { type: 'icon', icon: '🤖', text: 'Natural language queries' },
        { type: 'icon', icon: '🔍', text: 'Real-time killmail search' },
        { type: 'icon', icon: '🌐', text: 'Web search enabled' },
      ],
    },
  };

  return await render('pages/ai.hbs', pageContext, data, event);
});
