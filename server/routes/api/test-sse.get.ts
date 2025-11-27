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
