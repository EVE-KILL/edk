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

  return await render('pages/ai.hbs', pageContext, {}, event);
});
