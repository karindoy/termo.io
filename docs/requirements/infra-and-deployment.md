# Infra & Deployment

## Overview

How termo.io actually runs in Docker today: **two backend instances behind an nginx gateway with sticky room-based routing**, not the single-backend topology `.kiro/steering/tech.md` describes.

## Business Requirements (operational)

1. The service must survive a single backend instance restarting without dropping players connected to the other instance's rooms.
2. Redis (shared game/session state) must not be reachable from outside the deployment — only the app's own services should reach it.
3. Local development without Docker must remain possible (a developer can run backend/frontend directly against a local Redis).

## Technical Requirements

1. **Topology** (`docker-compose.yml`, repo root — not `infra/docker-compose.yml` as README currently says, that directory doesn't exist):
   - `backend_a` / `backend_b`: two instances of the same backend image, differing only by `INSTANCE_TAG: A` / `B`. Not directly published — reached only through the gateway.
   - `gateway`: `nginx:1.27-alpine`, mounts `nginx/nginx.conf`, publishes `4000:80` — the only backend-facing host port.
   - `frontend`: multi-stage build (Node build → static nginx), publishes `5173:80`.
   - `redis`: `redis:7-alpine`, **no published host port** (fixed in commit `776976c` — previously mapped `6379:6379`, removed since it has no auth and backends only need it over the internal compose network).
2. **Sticky routing** (`nginx/nginx.conf`): not simple round-robin. Parses the room code's first character — the fixed `instanceTag` (see [rooms-and-lobby.md](rooms-and-lobby.md)) — from either the Socket.IO handshake query (`$arg_code`) or the `/rooms/<CODE>...` URL path, and routes `A`-prefixed codes to `backend_a`, `B`-prefixed to `backend_b`. Requests with no room code (room creation, public-lobby listing, daily modes, `/health`) go to a round-robin `backend_pool` upstream instead. This exists because in-process game state (`GameModeRegistry`, `HostMigrationTracker`, the room-lock mutex) is **not shared** across instances even though Socket.IO broadcast fan-out **is**, via `@socket.io/redis-adapter` (wired in `backend/src/index.ts`).
3. **Boot-time cleanup is instance-scoped**: `clearPublicLobbies(instanceTag)` runs once at startup (`backend/src/index.ts`) to drop *this instance's own* stale public-lobby Redis entries, filtering by the `instanceTag` prefix on room codes and doing a scoped `srem` rather than clearing the whole `rooms:public-lobbies` set. Fixed in commit `070219a` — before this, restarting either instance wiped the *other* instance's live rooms too (since they share one Redis), kicking those players with `ROOM_NOT_FOUND`.
4. **Environment variables actually read** (`backend/src/infrastructure/config/env.ts` unless noted):
   | Var | Default | Purpose |
   |---|---|---|
   | `PORT` | `4000` | Backend HTTP/Socket.io port |
   | `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
   | `REDIS_URL` | `redis://redis:6379` | Redis connection string (README's documented default, `redis://localhost:6379`, differs slightly — that's the non-Docker local-dev value) |
   | `INSTANCE_TAG` | `'A'` | Selects this backend's room-code prefix for sticky routing; **undocumented in README today** |
   | `E2E_FIXED_WORDS` | unset | Deterministic word cycling for e2e tests (`in-memory-word-repository.ts`); **undocumented in README today** |
5. **Dockerfiles**: multi-stage (`deps` → `build` → `runtime`), build context = repo root (needed for npm workspace resolution), `npm ci --workspace=<pkg> --include-workspace-root`, non-root (`USER node`), `HEALTHCHECK` blocks (backend hits `/health`, frontend hits `/`).
6. **E2E's own stack** is separate: `e2e/docker-compose.yml` (redis + backend + frontend + a Playwright runner, healthcheck-gated `depends_on`) — not part of the production topology. See [testing-and-tooling.md](testing-and-tooling.md).
7. Local dev without Docker: `npm run dev:backend` / `dev:backend` directly against a locally-run Redis container — no separate dev-compose file exists.

## Acceptance Criteria

- [ ] Restarting `backend_a` does not affect rooms whose codes route to `backend_b`.
- [ ] Redis is not reachable from outside the Docker network (no published port).
- [ ] A room created on one instance is joinable by all its players consistently for its whole lifetime (no mid-game instance switch).
- [ ] `GET /rooms` (public lobby list) and `/health` work regardless of which instance ends up serving them.
- [ ] Setting `INSTANCE_TAG=B` on a backend causes it to own `B`-prefixed room codes.

## Known Issues / Cleanup Notes

- `.kiro/steering/tech.md` describes a single-backend, single-Redis topology with no mention of `INSTANCE_TAG`, nginx sticky routing, or `@socket.io/redis-adapter` — this entire multi-instance design is undocumented there today.
- `README.md`'s "Run with Docker" instructions reference `infra/docker-compose.yml`, a path that no longer exists (the compose file is at the repo root).
- `README.md`'s environment-variable table omits `INSTANCE_TAG` and `E2E_FIXED_WORDS` entirely, and doesn't mention that rate limiting (see [session-identity-and-security.md](session-identity-and-security.md)) or `@fastify/helmet` are active.
