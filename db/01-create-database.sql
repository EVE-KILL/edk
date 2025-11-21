-- Create database if it doesn't exist
-- Note: In Postgres, creating a database inside a transaction block (which migration runners often use) or conditional creation is tricky.
-- Usually the database is created before running migrations.
-- But for compatibility, we can use this check block if running as a script.
SELECT 'CREATE DATABASE edk'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'edk')\gexec
