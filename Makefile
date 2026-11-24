# Ma'rad Al-Ashya' — developer entry points. `make up` is the only command you need.
COMPOSE := docker compose -f infra/docker-compose.yml

.PHONY: help env up seed demo down logs ps e2e clean

help: ## List targets
	@grep -E '^[a-z0-9-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-8s %s\n", $$1, $$2}'

env: ## Create infra/.env with random secrets (never overwrites)
	@sh scripts/gen-env.sh

up: env ## Build and start the whole stack, wait until every service is healthy
	$(COMPOSE) up -d --build --wait --wait-timeout 600
	@echo ""
	@echo "  Web app      http://localhost:3100"
	@echo "  API gateway  http://localhost:3000/api/v1   (Swagger: http://localhost:3000/api/docs)"
	@echo "  Grafana      http://localhost:3200          (admin / GRAFANA_ADMIN_PASSWORD in infra/.env)"
	@echo "  Prometheus   http://localhost:9090"
	@echo "  Jaeger       http://localhost:16686"

seed: ## Load demo accounts and listings (idempotent)
	node scripts/seed-demo.mjs

demo: ## Guided tour through the API (after make up)
	sh scripts/demo.sh

down: ## Stop the stack (keeps data volumes)
	$(COMPOSE) down

logs: ## Follow logs of all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show service health
	$(COMPOSE) ps

e2e: ## Run the end-to-end smoke journey against the running stack
	node scripts/e2e-smoke.mjs

clean: ## Stop the stack and delete its data volumes
	$(COMPOSE) down -v
