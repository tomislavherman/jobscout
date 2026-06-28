# JobScout — Claude Code guide

## What this project is

JobScout aggregates job listings from community sources (currently Hacker News hiring threads), parses them with an LLM into structured fields, and lets signed-in users track their application pipeline per listing.

---

## Repository layout

```
jobscout/
├── backend/          Go server (chi, MySQL, custom JWT)
│   ├── cmd/server/   main entrypoint
│   ├── cmd/setauth/  CLI tool to promote a user to admin
│   └── internal/
│       ├── config/   env loading
│       ├── db/       RunMigrations + embedded SQL files
│       ├── hn/       HN API client
│       ├── llm/      Anthropic API client
│       ├── model/    shared structs (User, etc.)
│       └── server/   HTTP handlers, middleware, source config
├── frontend/         React + TypeScript + Vite + Tailwind v4
│   └── src/
│       ├── api.ts        all fetch calls, token management
│       ├── types.ts      shared TS types (JobStatus etc.)
│       ├── views/        page-level components
│       ├── components/   reusable UI components
│       └── hooks/        useInfiniteScroll
├── Makefile
├── docker-compose.yml   MySQL only
└── .env                 not committed; see .env.example
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend language | Go 1.25 |
| HTTP router | go-chi/chi v5 |
| Database | MySQL 8 via go-sql-driver |
| Auth | Custom HMAC-SHA256 JWT (access + refresh tokens) |
| LLM | Anthropic Claude API (`internal/llm`) |
| Frontend | React 18, TypeScript 5.6, Vite 6, Tailwind CSS v4 |
| Build | Frontend dist embedded into Go binary via `//go:embed` |

---

## Local development

```bash
# 1. Start MySQL
make db-up

# 2. Copy and generate secrets
cp .env.example .env
make set-auth          # writes JWT_SECRET to .env
# Also set ANTHROPIC_API_KEY in .env

# 3. Run backend (runs migrations on start, serves frontend from ./static)
make dev

# 4. In a separate terminal, run frontend dev server
cd frontend && npm run dev
```

Vite proxies `/api/*` to `localhost:8080` in dev mode.

### Production build

```bash
make build   # builds frontend, copies dist into backend/internal/server/static, compiles Go binary
./jobscout
```

### Generate JWT secret

```bash
make set-auth
# generates a random 32-byte secret and writes JWT_SECRET to .env
```

The first user to sign up automatically receives the `admin` role.

---

## Database

Migrations live in `backend/internal/db/migrations/` and are embedded at compile time. The runner (`RunMigrations`) tracks executed files in a `schema_migrations` table and runs each file exactly once, in filename order.

**There is no sources table.** Sources are hardcoded in `backend/internal/server/source_config.go`. Source IDs must be stable integers — they are used as foreign keys in `sync_runs`, `user_source_settings`, and `source_settings`.

Current sources:

| ID | Name | FeedType |
|---|---|---|
| 1 | Ask HN: Who is Hiring? | hiring |
| 2 | Ask HN: Seeking Freelancer? | freelancer |

### Key schema decisions

- `jobs.source_id` is a plain BIGINT with no FK (sources table was removed after seeding).
- `user_source_settings.source_id` also has no FK for the same reason.
- `sync_batch_size` in `source_settings`: `NULL` = not set → default 10; `0` = unlimited; `N` = cap at N.
- `source_requests.url` is NOT NULL and required; `name` column does not exist.

---

## Backend conventions

- All handlers live on `*Server` in `internal/server/`.
- Auth: `authMiddleware` requires a valid Bearer token; `optionalAuthMiddleware` parses the token if present but never rejects; `adminMiddleware` requires role = admin.
- `claimsFromContext(r)` returns nil on unauthenticated requests — always nil-check before use.
- `jsonResponse(w, status, v)` is the only way to write JSON responses.
- `decodeJSON(r, &v)` decodes request bodies.
- Sync runs in a goroutine (`go RunSync(...)`). Status is polled by the frontend — the sync handler returns immediately after inserting the `sync_runs` row.

---

## Frontend conventions

- `src/api.ts` is the single source of truth for all API calls. Handles token storage, auto-refresh on 401, and dispatches `auth:logout` event when the session cannot be recovered.
- `JobStatus` in `types.ts` is the union type for all valid statuses. When adding a status: update `types.ts`, `STATUS_LABELS` in `api.ts`, `ALL_STATUSES` + `STATUS_COLORS` in `StatusActions.tsx`, `TAB_COLORS` in `AllJobs.tsx`, and `validStatuses` in `backend/internal/server/jobs.go`.
- Responsive layout: desktop = left sidebar (`hidden lg:flex`), mobile = bottom tab bar (`lg:hidden fixed bottom-0`). Main content has `pb-20 lg:pb-6` to clear the mobile nav.
- Infinite scroll (mobile only) via `useInfiniteScroll` hook — uses `IntersectionObserver` on a sentinel div, only triggers when `window.matchMedia('(max-width: 1023px)').matches`.
- Pull-to-refresh via `PullToRefresh` component — attaches touch events to `document`, checks `document.querySelector('main')?.scrollTop` to detect top of scroll.
- Public landing (`PublicLanding.tsx`) uses two separate state fields: `view` (background content) and `modal` (overlay). Changing `modal` to `'login'` or `'signup'` never changes `view`, so the background stays put when the auth overlay opens.
- Modal forms (`Login`, `Signup`) accept a `modal?: boolean` prop. When true they return only the card; when false they wrap it in a full-screen centered container.
- Dropdowns (max age, batch size) use a custom pill-style component pattern (see `BatchSizeDropdown` in `Admin.tsx` or `MaxAgeDropdown` in `Sources.tsx`) — not native `<select>`.

---

## Key decisions

- **No sources DB table**: sources are hardcoded structs. Adding a new source means adding to `source_config.go` and giving it a stable integer ID. Avoids a sources CRUD admin UI while the source list is small.
- **Batch size sentinel 0 = unlimited**: NULL in `source_settings.sync_batch_size` means "not configured, default to 10". Zero means unlimited (backend passes nil cap to the HN fetcher). This avoids a separate boolean column.
- **Custom JWT instead of a library**: HMAC-SHA256, signed with `JWT_SECRET`. Access tokens are short-lived; refresh tokens are stored in `localStorage`. The token format is a standard three-part JWT.
- **LLM for job parsing**: each HN comment is sent to Claude to extract structured fields (role, company, location, remote type, salary, etc.). Raw text is also stored.
- **Separate access/refresh token flow**: `api.ts` retries any 401 with a token refresh before propagating the error, so token expiry is invisible to the user in normal usage.
- **Pull-to-refresh on document, not the scroll container**: the scrollable element is `<main>` but touch events are attached to `document` to avoid capture conflicts. Scroll position is checked via `document.querySelector('main')?.scrollTop`.
