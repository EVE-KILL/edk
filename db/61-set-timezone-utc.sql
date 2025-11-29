-- Ensure database sessions default to UTC so timestamp inputs are not shifted
-- Note: This requires superuser privileges, so we set it at session level instead
SET timezone TO 'UTC';
