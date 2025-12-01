/**
 * @openapi
 * /api/ai/query:
 *   get:
 *     summary: AI-powered EVE-KILL query
 *     description: Uses AI to process natural language questions about killmails, items, characters, and EVE Online data. Returns formatted response with visual HTML and statistics.
 *     tags:
 *       - AI
 *     parameters:
 *       - name: query
 *         in: query
 *         required: true
 *         description: Natural language question or command about EVE Online/killmails
 *         schema:
 *           type: string
 *           example: "Show me the most expensive kills in Jita today"
 *     responses:
 *       '200':
 *         description: AI response with data and HTML visualization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - query
 *                 - message
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 query:
 *                   type: string
 *                   example: "Show me expensive kills"
 *                 message:
 *                   type: string
 *                   description: AI-generated response
 *                   example: "Found 5 kills valued over 1 billion ISK..."
 *                 html:
 *                   type: string
 *                   description: HTML visualization of results
 *                 tools_used:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["search_killmails", "lookup_item"]
 *                 turns:
 *                   type: integer
 *                   example: 2
 *       '400':
 *         description: Missing query parameter
 *       '500':
 *         description: AI processing error
 */

/**
 * AI Query Endpoint - Simple JSON Response
 *
 * GET /api/ai/query?query=your+question
 */

import OpenAI from 'openai';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userQuery = query.query as string;

  if (!userQuery) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing query parameter',
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL || 'anthropic/claude-3.5-sonnet';

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OPENAI_API_KEY is not set',
    });
  }

  try {
    const htmlParts: string[] = [];
    const toolsUsed: string[] = [];
    let finalMessage = '';

    // Lazy-load dependencies
    const { getAllToolDefinitions, executeTool } =
      await import('../../ai/tool-loader');
    const { database } = await import('../../helpers/database');
    const { render } = await import('../../helpers/templates');

    const tools = getAllToolDefinitions();

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    const systemPrompt = `You are a helpful AI assistant for EVE-KILL, a killmail tracking system for EVE Online.

You have access to tools that display killmail data, item info, character info, and can search the web. When the user asks:
1. Determine which tool(s) best answer their question
2. For EVE Online news/events NOT in killmails, use web_search
3. For "where to hunt", "active systems", "hotspots", use find_hunting_grounds
4. For item/ship/module info (e.g., "what is a Raven", "show me Drake Navy Issue"), use lookup_item
5. For character info with portraits, use show_character_info
6. For location names (like "Jita"), use lookup_location to get the ID
7. For complex killmail queries with filters, use search_killmails
8. Tools display visual results directly - you'll get stats back to discuss
9. Always USE THE STATS in your response with specific numbers

Important:
- Mention specific numbers from stats (total value, count, averages)
- For expensive kills, mention top value and ship
- For searches, mention applied filters
- For web search, cite sources
- For hunting grounds, mention activity levels
- For items, mention the category/group
- For characters, mention their corp/alliance
- Use markdown formatting: **bold**, *italic*, inline code, and links
- Be conversational but data-driven

Current date: ${new Date().toISOString().split('T')[0]}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery },
    ];

    const maxTurns = 10;
    let turn = 0;

    while (turn < maxTurns) {
      turn++;

      const response = await client.chat.completions.create({
        model,
        messages,
        tools,
        timeout: 30000,
      });

      const choice = response.choices[0];
      if (!choice?.message) break;

      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      // Handle tool calls
      if (assistantMessage.tool_calls?.length) {
        toolsUsed.push(
          ...assistantMessage.tool_calls.map((t) => t.function.name)
        );

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          const toolContext = {
            database,
            render,
            logger,
          };

          const result = await executeTool(toolName, args, toolContext);

          if (result.html) {
            htmlParts.push(result.html);
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.error || JSON.stringify(result.stats || {}),
          });
        }

        continue;
      }

      // No tool calls - save text response
      if (assistantMessage.content) {
        finalMessage = assistantMessage.content;
      }

      break;
    }

    return {
      success: true,
      query: userQuery,
      message: finalMessage,
      html: htmlParts.join('\n'),
      tools_used: toolsUsed,
      turns: turn,
    };
  } catch (error: any) {
    logger.error('[ai-query] Error:', error);

    // Check for provider-specific errors
    const statusMessage =
      error.error?.message || error.message || 'AI processing failed';
    const isProviderError =
      statusMessage.includes('Provider returned error') ||
      statusMessage.includes('context_length_exceeded') ||
      statusMessage.includes('invalid_request_error');

    throw createError({
      statusCode: isProviderError ? 422 : 500,
      statusMessage,
    });
  }
});
