# Makefile for edk

.PHONY: help setup reset migrate import-sde wait-for-services
.PHONY: dev-tmux dev

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
	@bun cli db:partitions
	@bun cli sde:download
	@bun cli sde:refresh-mv
	@bun cli search:seed
	@echo "Setup complete!"

reset: ## Reset the development environment (remove all Docker volumes and data)
	@echo "Resetting the development environment..."
	@docker-compose down -v
	@rm -rf .data
	@echo "Reset complete!"

migrate: ## Run database migrations
	@echo "Running database migrations..."
	@bun cli db:migrate
	@echo "Migrations complete!"

import-sde: ## Download and import the latest SDE data
	@echo "Importing SDE..."
	@bun cli sde:download
	@bun cli sde:refresh-mv
	@echo "SDE import complete!"

DATA_FLAG := .data/.configured

$(DATA_FLAG): setup
	@mkdir -p .data
	@touch $(DATA_FLAG)

dev-tmux: ## Launch dev processes in a tmux session (dev/ws/queue/cronjobs/redisq listener)
dev-tmux: $(DATA_FLAG)
	@bun cli db:partitions
	@bun cli search:seed
	@command -v tmux >/dev/null 2>&1 || { echo "tmux is required for dev-tmux"; exit 1; }
		@SESSION=edk-dev; \
			tmux has-session -t $$SESSION 2>/dev/null && tmux kill-session -t $$SESSION; \
			tmux new-session -d -s $$SESSION "bash -lc 'trap : INT; bun --bun run dev; trap - INT; exec bash'"; \
			tmux set-option -t $$SESSION mouse on; \
			tmux split-window -h -t $$SESSION:0 "bash -lc 'trap : INT; bun ws; trap - INT; exec bash'"; \
			tmux split-window -v -t $$SESSION:0.0 "bash -lc 'trap : INT; bun queue; trap - INT; exec bash'"; \
			tmux split-window -v -t $$SESSION:0.1 "bash -lc 'trap : INT; bun cronjobs; trap - INT; exec bash'"; \
			tmux split-window -v -t $$SESSION:0.3 "bash -lc 'trap : INT; bun cli listeners:redisq; trap - INT; exec bash'"; \
			tmux select-layout -t $$SESSION:0 tiled; \
			tmux attach -t $$SESSION

dev: dev-tmux

wait-for-services: ## Wait for PostgreSQL, Redis, and Typesense to be ready
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
	@echo "Waiting for Typesense to be ready..."
	@until curl -s http://localhost:8108/health > /dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "Typesense is ready."
