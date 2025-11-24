-- Ensure database sessions default to UTC so timestamp inputs are not shifted
ALTER DATABASE edk SET timezone TO 'UTC';
