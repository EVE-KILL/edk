# Database Migrations

This directory contains the database migrations for the project. The migration system is designed to be simple and robust, allowing for safe and reversible changes to the database schema.

## Migration File Structure

Migrations are structured with `up` and `down` files, following the naming convention:

```
<version>-<name>.<direction>.sql
```

-   **`<version>`**: A unique, sequential number (e.g., `01`, `02`, `10`).
-   **`<name>`**: A short, descriptive name for the migration (e.g., `create-users-table`).
-   **`<direction>`**: Either `up` or `down`.

For example:

```
01-create-users-table.up.sql
01-create-users-table.down.sql
```

## Best Practices

-   **Always Write Down Migrations**: Never make manual changes to the database schema. Always create a new migration file for every change.
-   **Test Rollbacks Before Committing**: Before committing a new migration, always test that both the `up` and `down` migrations work as expected. You can do this locally by running `bun cli db:migrate` and then `bun cli db:rollback`.
-   **Avoid Destructive Changes When Possible**: Avoid destructive changes like dropping columns or tables in `up` migrations. If you must make a destructive change, ensure that the `down` migration correctly restores the schema.
-   **Keep Migrations Small and Focused**: Each migration should represent a single, atomic change to the database schema. This makes it easier to debug and roll back individual changes.
-   **Do Not Edit Applied Migrations**: Once a migration has been applied to the production database, it should never be edited. If you need to make a change, create a new migration file.
