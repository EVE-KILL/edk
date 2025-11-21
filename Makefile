# Makefile for edk

.PHONY: setup reset migrate import-sde

setup:
	@echo "Setting up the development environment..."
	@docker-compose up -d || (echo "Failed to start Docker services"; exit 1)
	@echo "Waiting for services to be ready..."
	@sleep 5
	@bun install || (echo "Failed to install dependencies"; exit 1)
	@bun cli db:migrate || (echo "Failed to run migrations"; exit 1)
	@bun cli sde:import || (echo "Failed to import SDE"; exit 1)
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
