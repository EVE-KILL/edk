# How to Add a New Model

In this project, "models" are represented by the database tables. Adding a new model involves creating a new SQL migration file to define the table's schema.

## Creating a New Model

Let's say we want to add a `tags` model that can be associated with killmails.

1.  **Create a New Migration File:**

    Create a new SQL file in the `db/` directory. The filename should be prefixed with a number that is higher than the existing migration files to ensure it runs in the correct order. For example:

    `db/50-create-tags-table.sql`

2.  **Define the Table Schema:**

    Open the new file and add the SQL statement to create the new table:

    ```sql
    -- ============================================================================
    -- TAGS TABLE
    -- ============================================================================

    CREATE TABLE IF NOT EXISTS tags (
      "tagId" SERIAL PRIMARY KEY,
      "tagName" VARCHAR(255) UNIQUE NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );

    -- You might also want a join table to link tags to killmails
    CREATE TABLE IF NOT EXISTS killmail_tags (
      "killmailId" INTEGER NOT NULL,
      "tagId" INTEGER NOT NULL,
      PRIMARY KEY ("killmailId", "tagId"),
      FOREIGN KEY ("killmailId") REFERENCES killmails("killmailId") ON DELETE CASCADE,
      FOREIGN KEY ("tagId") REFERENCES tags("tagId") ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "idx_killmail_tags_killmailId" ON killmail_tags ("killmailId");
    CREATE INDEX IF NOT EXISTS "idx_killmail_tags_tagId" ON killmail_tags ("tagId");
    ```

3.  **Run the Migrations:**

    The application's schema migration system will automatically detect and apply the new migration file the next time the application starts. You can also run the migrations manually:

    ```bash
    bun cli db:migrate
    ```

## Using the New Model in Code

Once the new table has been created, you can interact with it using the `database` helper.

### Example: Inserting a New Tag

Here's how you might insert a new tag from a route handler:

```typescript
import { database } from '~/server/helpers/database';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const tagName = body.tagName;

  if (!tagName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'tagName is required',
    });
  }

  const [newTag] = await database.sql`
    INSERT INTO tags ("tagName")
    VALUES (${tagName})
    RETURNING *
  `;

  return newTag;
});
```

This example demonstrates how to insert a new row into the `tags` table and return the newly created record.
