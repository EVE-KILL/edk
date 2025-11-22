
            CREATE TABLE IF NOT EXISTS test_migration_table (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                new_column INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending,active'
            );
