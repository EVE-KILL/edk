# Makefile for edk

.PHONY: setup reset migrate import-sde

setup:
	@echo "Setting up the development environment..."
	@docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@bun install
	@bun cli db:migrate
	@bun cli sde:import
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
	@bun cli sde:import
	@echo "SDE import complete!"
