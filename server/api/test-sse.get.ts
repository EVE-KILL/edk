/**
 * @openapi
 * /api/test-sse:
 *   get:
 *     summary: Test SSE streaming with counter
 *     description: Test endpoint for Server-Sent Events. Sends 3 numbered messages at 1-second intervals, then closes.
 *     tags:
 *       - Testing
 *     responses:
 *       '200':
 *         description: Server-Sent Events stream with messages
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
export default defineEventHandler(async (event) => {
  const eventStream = createEventStream(event);

  let counter = 0;
  const interval = setInterval(async () => {
    counter++;
    await eventStream.push(
      `Message ${counter} @ ${new Date().toLocaleTimeString()}`
    );
    if (counter >= 3) {
      clearInterval(interval);
      await eventStream.close();
    }
  }, 1000);

  eventStream.onClosed(async () => {
    clearInterval(interval);
    await eventStream.close();
  });

  return eventStream.send();
});
