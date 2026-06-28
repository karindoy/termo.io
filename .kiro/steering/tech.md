---
inclusion: always
---

# Technology Stack

## Language & Runtime

- **Node.js** (LTS) + **TypeScript**, `strict: true` in `tsconfig.json` — non-negotiable. No `any`; use `unknown` + narrowing or generics.

## Backend

- **Framework**: Fastify (preferred for performance) or Express for HTTP (room creation/lookup, health, leaderboard if added).
- **Real-time**: **Socket.io** (or raw `ws`) for room state, guess submissions, and broadcasting every player's attempts/feedback to the room. Real-time concerns live in `infrastructure`/`presentation` — domain logic (word matching, scoring, round transitions) stays transport-agnostic.
- **Validation**: `zod` at every boundary (HTTP body, socket event payloads, env vars) — never trust raw client input, especially guess submissions.
- **Persistence**:
  - **Redis** for live room/game state (players, current word index, attempts, scores) — rooms are short-lived and need fast read/write with TTL cleanup.
  - **Postgres** (or simpler, a versioned static word list file/table) for the Brazilian Portuguese word dictionary (valid secret words + valid-guess word list). Add a DB only if word-list size/management actually needs it — a curated JSON/SQLite word list may be enough for v1.
- **Word resolution & scoring authority**: secret word selection, guess validation (correct/in-word/absent + position), attempt counting, and point/win determination happen **server-side only**. The client never receives the secret word or computes correctness itself.
- **Concurrency-critical logic**: in Round Mode, "first correct guess scores the point" requires the server to be the single source of truth and process guesses in a strict order per room (no client timestamps) to avoid race conditions with 50 concurrent players.

## Word Dictionary & Matching Rules

- **Fixed length**: every word in the dictionary is exactly **5 letters**. `WordRepository` only ever returns/validates 5-letter entries — enforced at data-load time (fail fast on a malformed dictionary file), not per-guess.
- **Accent-insensitive comparison**: the feedback algorithm (in `domain`) compares guess and secret letters using a **normalized form** (diacritics stripped via Unicode NFD + combining-mark removal, e.g. `á`/`à`/`â`/`ã` → `a`, `ç` → `c`) for *both* the green (position match) and yellow (present-elsewhere) checks. The secret word's original accented spelling is preserved separately and only ever sent to the client at reveal time (word solved, attempts/timer exhausted, or tie-break resolution) — never used for live comparison logic, so a player typing the plain letter on a position with an accented secret letter is scored green.
- **No repeat-avoidance**: `WordRepository.getRandomWord()` has no exclusion/history list — the same word can legitimately be selected again in the same room, same session, or back-to-back games. No "used words" state to maintain in Redis or elsewhere.

## Session Identity & Anti-Abuse

- **Player identity**: a long-lived, signed `playerId` cookie is set on first visit (not session-only, not httpOnly-restricted on read since the client never needs to read it — server sets/verifies it). Because cookies are shared across all tabs of the same browser, opening a second tab reuses the same `playerId` rather than minting a new one.
- **Attempts/score keyed by `playerId`, not socket id**: Redis game state is stored per `playerId` within a room. A second socket connecting with a `playerId` already active in that room is treated as a **reconnect** — it takes over the existing slot (remaining attempts, score, board state) instead of creating a new one. This single mechanism both closes the multi-tab extra-attempts exploit and implements reconnect/state-restore (no separate reconnect system to build).
- **Soft secondary defense**: rate-limit/cap distinct `playerId`s joining the same room from one IP within a short window — a deterrent against incognito/multi-browser farming, not a guarantee (no-account systems can't fully prevent this; documented as a known limitation).
- **Host migration**: each room keeps a join-order succession list of connected players. On host disconnect, a 30s grace period allows reconnect-as-host (same `playerId`); if it lapses, host transfers permanently to the longest-connected remaining player, broadcast via socket event (`host:migrated`).
- **Private room codes**: generated server-side with a CSPRNG — 8 characters from a 32-symbol alphabet excluding visually ambiguous characters (`0`/`O`, `1`/`I`/`L`), keyspace ≈ 32⁸. The join-by-code path has its own dedicated rate limit (distinct from general API rate limiting) since it's an enumeration target; codes are invalidated immediately when their room is torn down.

## Frontend

- **Framework**: React + TypeScript (Vite).
- **Board UI**: grid components per player (own board prominent, other players' boards visible — compact view showing attempt count/colors per position). State is server-authoritative: the client renders feedback the server sends, it does not compute green/yellow locally beyond optimistic UI if needed.
- **Styling**: Tailwind CSS or CSS Modules — pick one, don't mix.

## Architecture Pattern

Layered/Clean Architecture (see `structure.md`): `domain` (word matching rules, scoring, round/game lifecycle) → `application` (use cases: create room, join room, submit guess, advance word) → `infrastructure` (Socket.io, Redis, word dictionary store) → `presentation` (HTTP routes + socket event handlers).

## Design Patterns in Use

- **Repository**: `RoomRepository` (Redis-backed), `WordRepository` (dictionary lookup/validation) — interfaces in `domain`, implementations in `infrastructure`.
- **Strategy**: `GameMode` interface with two implementations — `RoundMode` (6 attempts, per-word point to first correct guess) and `FastMode` (infinite attempts, first to finish all 5 words wins). Adding a future mode means implementing the interface, not branching in use-cases.
- **Factory**: `RoomFactory`/`GameFactory` for constructing valid room/game state (assigns the 5 secret words, initializes per-player attempt state).
- **Observer/Event Emitter**: domain events (`guess.submitted`, `word.resolved`, `game.ended`) decoupled from socket broadcasting logic.
- **Adapter**: wrap Socket.io/Redis clients behind internal interfaces so they're mockable in tests.

## Containerization (Docker)

The app is developed and deployed via Docker — local dev, CI, and production all run the same images. Each package owns its own image; `infra/` only orchestrates.

- **Per-package `Dockerfile`**: `backend/Dockerfile` and `frontend/Dockerfile` each live next to the code they build — backend responsibility owns its image, frontend owns its own (build → static Nginx serve). Neither package's Dockerfile reaches outside its own directory.
- **Multi-stage builds**: `deps` → `build` → `runtime`. Final runtime image contains only compiled output (`backend/dist`, `frontend/dist`) and production `node_modules`, never source/dev dependencies.
- **Base image**: pinned `node:<lts>-alpine` (specific version tag, never `latest`) for a small, reproducible image; frontend runtime stage uses pinned `nginx:<version>-alpine` to serve the static build.
- **Reproducible installs**: `npm ci` (not `npm install`) using each package's committed lockfile.
- **Non-root user**: runtime containers run as an unprivileged user (`USER node`), never root.
- **Small surface area**: shared `.dockerignore` (referenced from `infra/`, or duplicated per package) excludes `node_modules`, `.git`, `dist`, `.env*`, test files — keeps build context and image lean and avoids leaking secrets into layers.
- **Signal handling**: `NODE_ENV=production` set explicitly; Node receives signals directly (no shell-form `CMD`) so `docker stop`/orchestrator shutdowns terminate gracefully and Socket.io connections drain.
- **Healthcheck**: backend `HEALTHCHECK` hits a lightweight `/health` HTTP endpoint so orchestrators (Compose/Kubernetes) can detect a stuck process.
- **No secrets in images**: all config (Redis URL, ports, word-list source) via environment variables injected at runtime, defined in `infra/env/.env.example`, never baked into an image or committed as a real `.env`.
- **Orchestration lives in `infra/`**: `infra/docker-compose.yml` wires `backend` + `frontend` + **Redis** (pinned version, e.g. `redis:7-alpine`) for local dev and CI integration tests — mirrors production topology so "works in dev" means "works in prod." `infra/docker-compose.dev.yml` adds bind mounts/hot-reload overrides; it never replaces the base compose file's service topology.
- **Image versioning**: tag images with commit SHA (or semver on release), not just `latest`, for traceable, rollback-able deploys.

## Testing

- **Unit**: Vitest or Jest for `domain`/`application` — word-matching/feedback logic (green/yellow/gray), attempt limits, scoring, win conditions for both modes.
- **Integration**: repository tests against real (containerized) Redis.
- **E2E/real-time**: Socket.io client-driven tests simulating multi-player rooms (join, concurrent guesses, first-correct-guess race in Round Mode, first-to-finish race in Fast Mode).

## Tooling

- ESLint (`@typescript-eslint`) + Prettier, pre-commit hook.
- Conventional Commits.
- CI gate: type-check, lint, test before merge.

## Common Commands

```bash
npm run dev          # start dev server (API + sockets)
npm run build         # compile TypeScript
npm run test          # run unit/integration tests
npm run lint           # eslint
npm run typecheck     # tsc --noEmit
```
