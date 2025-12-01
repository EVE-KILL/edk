/**
 * @openapi
 * /api/simple-sse:
 *   get:
 *     summary: Simple SSE test stream
 *     description: Test endpoint for Server-Sent Events. Sends one message and closes the stream after 1 second.
 *     tags:
 *       - Testing
 *     responses:
 *       '200':
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
export default defineEventHandler(async (event) => {
  const stream = createEventStream(event);

  // Send one message immediately
  await stream.push('Hello from SSE!');

  // Close after 1 second
  setTimeout(async () => {
    await stream.close();
  }, 1000);

  return stream.send();
});
