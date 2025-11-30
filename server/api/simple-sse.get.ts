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
