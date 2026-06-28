# JobScout

Job listings aggregator that pulls from community sources, parses them into structured fields, and lets you track your application pipeline.

## Features

- Pulls job listings from Hacker News hiring threads
- Extracts structured data — role, company, location, salary, remote policy
- Public browsing with shareable job URLs (`/jobs/:id`) — no account required
- Application tracking with statuses (New, Saved, Applied, Interviewing, Offer, Rejected, and more)
- Per-application timeline: interview notes, prep, feedback, reminders
- Per-source max age filter
- Mobile-friendly with infinite scroll and pull-to-refresh
- English / Croatian UI language toggle (persisted per browser)
- Admin panel for managing users, sync settings, and source suggestions

## Tech stack

- **Backend**: Go, chi, MySQL
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4
- **Auth**: JWT (access + refresh tokens)
- **Parsing**: Anthropic Claude API

## Getting started

### Prerequisites

- Go 1.25+
- Node.js 20+
- Docker (for MySQL)

### Setup

```bash
# 1. Start MySQL
make db-up

# 2. Configure environment
cp .env.example .env
make set-auth          # generates JWT_SECRET and writes it to .env
# Set ANTHROPIC_API_KEY in .env

# 3. Start the backend
make dev

# 4. Start the frontend dev server (separate terminal)
cd frontend && npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies `/api/*` to the backend on port 8080.

The first user to sign up automatically becomes an admin.

### Production build

```bash
make build   # compiles frontend into Go binary
./jobscout
```

### Reset database

```bash
make db-reset
```

## Environment variables

| Variable | Description |
|---|---|
| `MYSQL_DSN` | MySQL connection string |
| `PORT` | HTTP server port (default: 8080) |
| `JWT_SECRET` | Secret for signing JWTs — generate with `make set-auth` |
| `ANTHROPIC_API_KEY` | Claude API key for job parsing |
