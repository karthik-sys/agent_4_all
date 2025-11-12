.PHONY: help db-up db-down db-logs migrate-up migrate-down test-db clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

db-up: ## Start PostgreSQL and Redis
	@echo "Starting database services..."
	docker-compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	@docker-compose exec -T postgres pg_isready -U agentpay_user -d agentpay
	@echo "✓ Database services are running"

db-down: ## Stop and remove database containers
	@echo "Stopping database services..."
	docker-compose down
	@echo "✓ Database services stopped"

db-logs: ## Show database logs
	docker-compose logs -f postgres

migrate-up: ## Run database migrations
	@echo "Running migrations..."
	docker run --rm -v $(PWD)/database/migrations:/migrations --network host migrate/migrate \
		-path=/migrations -database "postgresql://agentpay_user:agentpay_dev_password@localhost:5432/agentpay?sslmode=disable" up
	@echo "✓ Migrations completed"

migrate-down: ## Rollback last migration
	@echo "Rolling back last migration..."
	docker run --rm -v $(PWD)/database/migrations:/migrations --network host migrate/migrate \
		-path=/migrations -database "postgresql://agentpay_user:agentpay_dev_password@localhost:5432/agentpay?sslmode=disable" down 1
	@echo "✓ Rollback completed"

migrate-create: ## Create a new migration (usage: make migrate-create NAME=create_users)
	@if [ -z "$(NAME)" ]; then \
		echo "Error: NAME is required. Usage: make migrate-create NAME=create_users"; \
		exit 1; \
	fi
	@TIMESTAMP=$$(date +%s); \
	touch database/migrations/$${TIMESTAMP}_$(NAME).up.sql; \
	touch database/migrations/$${TIMESTAMP}_$(NAME).down.sql; \
	echo "✓ Created migration files: $${TIMESTAMP}_$(NAME).{up,down}.sql"

test-db: ## Test database connection
	@echo "Testing database connection..."
	@python3 database/test_connection.py
	@echo "✓ Database connection successful"

clean: ## Clean up all data (WARNING: destroys all data)
	@echo "⚠️  This will destroy all data. Continue? [y/N]"
	@read -r response; \
	if [ "$$response" = "y" ] || [ "$$response" = "Y" ]; then \
		docker-compose down -v; \
		echo "✓ All data cleaned"; \
	else \
		echo "Cancelled"; \
	fi
