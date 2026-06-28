.PHONY: dev build db-up db-down db-reset clean frontend-build set-auth

# Start dev backend (start MySQL separately with `make db-up`)
dev:
	cd backend && go run ./cmd/server/

# Build production binary with embedded frontend
build: frontend-build
	cd backend && CGO_ENABLED=0 go build -o ../jobscout ./cmd/server/

# Build frontend and copy to Go embed directory
frontend-build:
	cd frontend && npm run build
	rm -rf backend/internal/server/static/*
	cp -r frontend/dist/* backend/internal/server/static/

set-auth:
	cd backend && go run ./cmd/setauth/

db-up:
	docker compose up -d mysql
	@echo "Waiting for MySQL to be ready..."
	@until docker compose exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; do sleep 1; done
	@echo "MySQL ready."

db-down:
	docker compose down

db-reset:
	docker compose down -v
	docker compose up -d mysql
	@echo "Waiting for MySQL to be ready..."
	@until docker compose exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; do sleep 1; done
	@echo "MySQL ready."

clean:
	rm -f jobscout
	rm -rf frontend/dist
	rm -rf backend/internal/server/static/*
