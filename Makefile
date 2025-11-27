# Makefile for EVE-KILL

# Default target
.DEFAULT_GOAL := help

# ==============================================================================
# Variables
# ==============================================================================

# Get the directory of the currently executing script
SHELL := /bin/bash
MAKEFILE_DIR := $(dir $(realpath $(firstword $(MAKEFILE_LIST))))

# ==============================================================================
# Setup & Management
# ==============================================================================

.PHONY: setup
setup: ## 🚀 Full one-time setup: services, deps, db, sde
	@echo "Setting up the development environment..."
	@docker compose up -d postgres redis
	@make wait-for-services
	@bun install
	@make migrate
	@make import-sde
	@touch .data/.configured
	@echo "✅ Setup complete!"

.PHONY: dev
dev: ## 🏃 Start all dev services (server, queue, etc.)
	@make wait-for-services
	@if [ ! -f .data/.configured ]; then make setup; fi
	@bun --watch run dev

.PHONY: reset
reset: ## 🧹 Clean up the environment
	@echo "Cleaning up..."
	@docker compose down -v --remove-orphans
	@rm -rf .data

# ==============================================================================
# Database
# ==============================================================================

.PHONY: migrate
migrate: ## 🧬 Apply database migrations
	@echo "Running database migrations..."
	@bun cli db:migrate

.PHONY: refresh-mv
refresh-mv: ## 🔄 Refresh materialized views
	@echo "Refreshing materialized views..."
	@bun cli db:refresh

# ==============================================================================
# SDE (Static Data Export)
# ==============================================================================

.PHONY: import-sde
import-sde: ## 📦 Download and import the SDE
	@echo "Importing SDE..."
	@bun cli sde:download

# ==============================================================================
# Utilities
# ==============================================================================

.PHONY: wait-for-services
wait-for-services: ## ⏱️ Wait for services to be ready
	@echo "Waiting for services..."
	@until docker compose exec postgres pg_isready -U postgres -d edk &> /dev/null; do \
		echo "Waiting for postgres..."; \
		sleep 2; \
	done
	@until docker compose exec redis redis-cli ping &> /dev/null; do \
		echo "Waiting for redis..."; \
		sleep 2; \
	done
	@echo "Services are ready!"

.PHONY: help
help: ## 🙋 Show this help
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: format
format: ## 💅 Format code with Prettier
	@echo "Formatting code..."
	@bun run format

.PHONY: lint
lint: ##  lint code with eslint
	@echo "Linting code..."
	@bun run lint
