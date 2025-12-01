/**
 * @openapi
 * /api/ai/stream-test:
 *   get:
 *     summary: Test AI streaming endpoint
 *     description: Testing endpoint for Server-Sent Events (SSE) streaming. Returns test data in event stream format.
 *     tags:
 *       - AI
 *     responses:
 *       '200':
 *         description: Server-Sent Events stream with test data
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: ["connected", "message", "done"]
 */

/**
 * Simple SSE test endpoint
 */

export default defineEventHandler(async (event) => {
  const eventStream = createEventStream(event);

  await eventStream.push(
    'data: {"type":"connected","message":"Test connected"}\n\n'
  );
  await eventStream.push(
    'data: {"type":"message","content":"Hello from AI!"}\n\n'
  );
  await eventStream.push('data: {"type":"done"}\n\n');

  await eventStream.close();
  return eventStream.send();
});
