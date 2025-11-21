# Makefile for edk

.PHONY: setup reset migrate import-sde wait-for-services

setup:
	@echo "Setting up the development environment..."
	@docker-compose up -d
	@echo "Waiting for services to be ready..."
	@make wait-for-services
	@bun install
	@bun cli db:migrate
	@bun cli sde:download
	@echo "Setup complete!"

reset:
	@echo "Resetting the development environment..."
	@docker-compose down -v
	@echo "Reset complete!"

migrate:
	@echo "Running database migrations..."
	@bun cli db:migrate
	@echo "Migrations complete!"

import-sde:
	@echo "Importing SDE..."
	@bun cli sde:download
	@echo "SDE import complete!"

wait-for-services:
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker-compose exec postgres pg_isready -U edk_user -d edk > /dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "PostgreSQL is ready."
	@echo "Waiting for Redis to be ready..."
	@until docker-compose exec redis redis-cli ping > /dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "Redis is ready."
