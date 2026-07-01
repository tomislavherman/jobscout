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

## Deploying on Ubuntu VPS

### Install dependencies

```bash
# make
sudo apt install -y make

# Go
sudo snap install go --classic

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Build and configure

```bash
cp .env.example .env
make set-auth   # generates JWT_SECRET and writes it to .env
# Edit .env and set:
#   MYSQL_DSN=<your managed MySQL connection string>
#   ANTHROPIC_API_KEY=<your key>

cd frontend && npm install && cd ..
make build
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

### Deploying on a subpath (e.g. `example.com/jobscout`)

Set `VITE_BASE_PATH` when building so the frontend references assets under the right path:

```bash
VITE_BASE_PATH=/jobscout/ make build
./jobscout
```

The Go server itself needs no changes — it always listens on `/`.

In `haproxy.cfg`, add an ACL to match the subpath and configure the backend to strip the prefix before forwarding to the app:

```
frontend http_in
    ...
    acl host_myapp hdr(host) -i myapp.example.com
    acl is_jobscout path_beg /jobscout
    use_backend jobscout if host_myapp is_jobscout

backend jobscout
    http-request replace-path /jobscout(.*) \1
    server app 127.0.0.1:8080 check
```

Then reload HAProxy:

```bash
sudo systemctl reload haproxy
```

## TLS Setup with Let's Encrypt and HAProxy

Uses certbot webroot method for HTTP-01 challenge, HAProxy for TLS termination.

### One-time Setup

**Install certbot** (also enables the automatic renewal timer):
```bash
sudo apt update && sudo apt install certbot -y
```

**Create directories:**
```bash
sudo mkdir -p /var/www/certbot /etc/haproxy/certs
```

**Run a permanent file server for ACME challenges:**
```bash
sudo tee /etc/systemd/system/certbot-webroot.service << 'UNIT'
[Unit]
Description=Static file server for ACME challenges
After=network.target

[Service]
ExecStart=/usr/bin/python3 -m http.server 9000 --directory /var/www/certbot
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl enable --now certbot-webroot.service
```

**Add to HAProxy config:**
```
frontend http_in
    bind *:80
    bind *:443 ssl crt /etc/haproxy/certs/

    acl is_acme path_beg /.well-known/acme-challenge/
    use_backend acme_challenge if is_acme

    acl host_myapp hdr(host) -i myapp.example.com
    use_backend myapp if host_myapp

backend acme_challenge
    server local 127.0.0.1:9000

backend myapp
    server app 127.0.0.1:8080 check
```

Note: `/etc/haproxy/certs/` must contain at least one `.pem` file before HAProxy will accept the `bind *:443 ssl` line. Issue the first certificate before adding it to the config.

**Set up deploy hook** (recombines PEM files and reloads HAProxy after every renewal):
```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/haproxy-reload.sh << 'HOOK'
#!/bin/bash
set -e
for live_dir in /etc/letsencrypt/live/*/; do
    [ -d "$live_dir" ] || continue
    domain=$(basename "$live_dir")
    cat "$live_dir/fullchain.pem" "$live_dir/privkey.pem" \
        > "/etc/haproxy/certs/${domain}.pem"
done
systemctl reload haproxy
HOOK

sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/haproxy-reload.sh
```

### Issuing a Certificate

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d myapp.example.com
```

Then run the deploy hook once manually (it only fires automatically on renewal, not first issuance):
```bash
sudo /etc/letsencrypt/renewal-hooks/deploy/haproxy-reload.sh
```

### Renewal

Certificates are valid for **90 days**. Renewal is automatic — `certbot.timer` runs `certbot renew` twice daily and only renews certs within 30 days of expiry. The deploy hook fires automatically on successful renewal, no manual steps needed.

Test the renewal pipeline:
```bash
sudo certbot renew --dry-run
```

### Adding a New Domain

1. Issue the certificate: `sudo certbot certonly --webroot -w /var/www/certbot -d newdomain.example.com`
2. Run the deploy hook manually: `sudo /etc/letsencrypt/renewal-hooks/deploy/haproxy-reload.sh`
3. Add ACL and backend for the new domain in `haproxy.cfg`, then `sudo systemctl reload haproxy`

No other config changes needed — HAProxy picks up new `.pem` files from the certs directory automatically on reload.

