# How to Add a New Queue

The application uses BullMQ to manage background jobs. Adding a new queue involves creating a new queue processor file.

## Creating a New Queue Processor

1.  **Create the file:**

    Create a new file in the `queue/` directory. The filename should correspond to the name of the queue. For example, to create a queue named `example`, create a file named `queue/example.ts`.

2.  **Add the processor logic:**

    Open the new file and add the following code:

    ```typescript
    import { type Job } from 'bullmq';
    import { logger } from '~/server/helpers/logger';

    export const name = 'example';

    export default function (job: Job) {
      logger.info(`Processing job ${job.id} in the example queue`);
      // Your job processing logic here
      logger.info(`Job data: ${JSON.stringify(job.data)}`);
    }
    ```

    - The `name` export is used to identify the queue.
    - The `default` export is the function that will be called to process jobs from this queue.

3.  **The queue is now ready to be used.** The queue runner (`bun queue`) will automatically discover and start processing jobs for this new queue.

## Enqueuing a Job

To add a job to your new queue, you can use the `enqueueJob` helper from `server/helpers/queue.ts`.

### Example: Enqueuing a Job from a Route

Here's an example of how you might enqueue a job from a route handler:

```typescript
import { enqueueJob, QueueType } from '~/server/helpers/queue';

export default defineEventHandler(async () => {
  await enqueueJob(QueueType.EXAMPLE, {
    message: 'This is a test job',
  });

  return {
    status: 'Job enqueued',
  };
});
```

To make this work, you would need to add `EXAMPLE = 'example'` to the `QueueType` enum in `server/helpers/queue.ts`.

### Adding to the `QueueType` Enum

Open `server/helpers/queue.ts` and add your new queue to the `QueueType` enum:

```typescript
// server/helpers/queue.ts

export enum QueueType {
  KILLMAIL = 'killmail',
  CORPORATION = 'corporation',
  CHARACTER = 'character',
  ALLIANCE = 'alliance',
  PRICE = 'price',
  EXAMPLE = 'example', // Add your new queue here
}
```
