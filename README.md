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
| `VITE_BASE_PATH` | Base path for frontend assets (e.g. `/jobscout/` for subpath deploy) |

---

## Deploying on a subpath (e.g. `example.com/jobscout`)

Set `VITE_BASE_PATH` when building so the frontend references assets under the right path:

```bash
VITE_BASE_PATH=/jobscout/ make build
./jobscout
```

Then configure your reverse proxy to strip the prefix before forwarding to the Go server.

**Nginx:**
```nginx
location /jobscout/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The Go server itself needs no changes — it always listens on `/` and the proxy handles the prefix.

---

## Deploying on Ubuntu VPS

### Install dependencies

```bash
# make
sudo apt install -y make

# Go (adjust version as needed)
wget https://go.dev/dl/go1.25.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo mysql -e "CREATE DATABASE jobscout; CREATE USER 'jobscout'@'localhost' IDENTIFIED BY 'yourpassword'; GRANT ALL ON jobscout.* TO 'jobscout'@'localhost';"
```

### Build and configure

```bash
cp .env.example .env
make set-auth   # generates JWT_SECRET and writes it to .env
# Edit .env and set:
#   MYSQL_DSN=jobscout:yourpassword@tcp(127.0.0.1:3306)/jobscout?parseTime=true
#   ANTHROPIC_API_KEY=<your key>
#   VITE_BASE_PATH=/jobscout/   # if serving at a subpath

VITE_BASE_PATH=/jobscout/ make build   # omit VITE_BASE_PATH if serving at root
```

### Run as a systemd service

A `jobscout.service` file is included in the repo:

```bash
sudo cp jobscout.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jobscout
sudo systemctl status jobscout
```

### HAProxy reverse proxy

A `haproxy.cfg` is included in the repo:

```bash
sudo apt install -y haproxy
sudo cp haproxy.cfg /etc/haproxy/haproxy.cfg
sudo systemctl enable --now haproxy
sudo systemctl reload haproxy
```
