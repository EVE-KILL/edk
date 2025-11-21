# Makefile for edk

.PHONY: help setup reset migrate import-sde wait-for-services

.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "EVE-KILL EDK - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Setup the development environment (Docker, install deps, migrate DB, download SDE)
	@echo "Setting up the development environment..."
	@docker-compose up -d
	@echo "Waiting for services to be ready..."
	@make wait-for-services
	@bun install
	@bun cli db:migrate
	@bun cli sde:download
	@echo "Setup complete!"

reset: ## Reset the development environment (remove all Docker volumes and data)
	@echo "Resetting the development environment..."
	@docker-compose down -v
	@echo "Reset complete!"

migrate: ## Run database migrations
	@echo "Running database migrations..."
	@bun cli db:migrate
	@echo "Migrations complete!"

import-sde: ## Download and import the latest SDE data
	@echo "Importing SDE..."
	@bun cli sde:download
	@echo "SDE import complete!"

wait-for-services: ## Wait for PostgreSQL and Redis to be ready
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
