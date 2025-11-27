# Troubleshooting Guide

This guide covers common issues that you may encounter while developing or running the EVE-KILL application.

## Database Connection Issues

-   **Error:** `FATAL: password authentication failed for user "..."`
    -   **Solution:** Check that the `DATABASE_URL` in your `.env` file is correct and that the username and password are correct for your PostgreSQL database.
-   **Error:** `FATAL: database "..." does not exist`
    -   **Solution:** Make sure that you have created the database and that the database name in your `DATABASE_URL` is correct.
-   **Error:** `max_locks_per_transaction`
    -   **Solution:** If you are not using the provided Docker setup, you may need to increase the `max_locks_per_transaction` setting in your `postgresql.conf` file. The recommended value is `200`.

## Redis Connection Issues

-   **Error:** `connect ECONNREFUSED ...`
    -   **Solution:** Ensure that Redis is running and that the `REDIS_HOST` and `REDIS_PORT` in your `.env` file are correct.

## Queue Problems

-   **Issue:** Jobs are not being processed.
    -   **Solution:**
        1.  Make sure that the queue workers are running (`bun queue`).
        2.  Check the logs for any errors.
        3.  Ensure that Redis is running and that the connection settings are correct.

## Migration Issues

-   **Issue:** Migrations are not being applied.
    -   **Solution:**
        1.  Check that the migration files are located in the `db/` directory and have a `.sql` extension.
        2.  Ensure that the filenames of new migrations have a higher number prefix than the existing migrations.
        3.  Check the `migrations` table in your database to see which migrations have already been applied.

## SDE Import Fails

-   **Issue:** The SDE import process (`bun cli sde:download`) fails.
    -   **Solution:**
        1.  Ensure you have a stable internet connection.
        2.  Check for sufficient disk space. The SDE is quite large.
        3.  If the process times out, you can try running it again. It is designed to be resumable.
