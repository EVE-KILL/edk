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
