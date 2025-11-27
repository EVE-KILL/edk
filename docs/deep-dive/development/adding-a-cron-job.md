# How to Add a New Cron Job

Cron jobs are used for running scheduled tasks. The application has a cron job runner that automatically discovers and schedules jobs from files in the `cronjobs/` directory.

## Creating a New Cron Job

1.  **Create the file:**

    Create a new file in the `cronjobs/` directory. The filename should be descriptive of the job it performs (e.g., `my-scheduled-task.ts`).

2.  **Add the cron job definition:**

    Open the new file and add the following code:

    ```typescript
    import { logger } from '~/server/helpers/logger';

    export const name = 'My Scheduled Task';

    export const schedule = '*/5 * * * *'; // Run every 5 minutes

    export const description = 'This is an example scheduled task.';

    export async function action() {
      logger.info('Running my scheduled task...');
      // Your task logic here
    }
    ```

    -   **`name`**: A human-readable name for the job.
    -   **`schedule`**: The cron schedule in standard cron format. You can use a tool like [crontab.guru](https://crontab.guru/) to help you create the schedule string.
    -   **`description`**: A brief description of what the job does.
    -   **`action`**: An `async` function that contains the logic to be executed when the job runs.

3.  **The cron job is now ready.** The cron job runner (`bun cronjobs`) will automatically discover this new job and schedule it to run according to the defined `schedule`.

## Cron Schedule Format

The cron schedule is a string with five fields, representing:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Common Examples

-   **Run every minute:** `* * * * *`
-   **Run every hour at the beginning of the hour:** `0 * * * *`
-   **Run once a day at midnight:** `0 0 * * *`
-   **Run every Tuesday at 3:30 PM:** `30 15 * * 2`
