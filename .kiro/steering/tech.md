---
inclusion: always
---

# Technology Stack & Project Structure

## Language & Runtime

- **Node.js** (LTS) + **TypeScript**, `strict: true` in `tsconfig.json` — non-negotiable. No `any`; use `unknown` + narrowing or generics.

## Project Structure

Monorepo split into three top-level responsibilities — **backend**, **frontend**, **infra** — each independently buildable/deployable. The backend follows layered/clean architecture: dependencies point inward, `domain` has zero external imports.

```
backend/
├── src/
│   ├── domain/
│   │   ├── entities/          # Room, Player, Game, Word, Attempt, Score
│   │   ├── value-objects/     # GuessFeedback, NormalizedLetter, RoomCode, RoomSettings, PlayerIdentity
│   │   ├── repositories/      # RoomRepository, WordRepository (interfaces only)
│   │   └── errors/            # RoomFullError, RoomNotFoundError, InvalidGuessError, AttemptsExceededError
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── room/          # create-room, join-room, leave-room, list-public-rooms, migrate-host
│   │   │   └── game/          # start-game, submit-guess, advance-to-next-word, end-game, resolve-tie-break
│   │   └── game-modes/        # GameMode interface + ChampionshipMode, RaceMode implementations
│   ├── infrastructure/
│   │   ├── persistence/
│   │   │   ├── redis/         # RoomRepository impl, live game/attempt state, TTL cleanup
│   │   │   └── words/         # WordRepository impl (BR-PT dictionary file)
│   │   ├── realtime/          # Socket.io server setup, event adapters
│   │   └── config/            # env loading, DI/composition root
│   ├── presentation/
│   │   ├── http/
│   │   │   ├── routes/        # public-rooms list, health
│   │   │   ├── controllers/
│   │   │   └── middlewares/   # error-handler, validation (zod), rate-limit
│   │   └── sockets/
│   │       ├── handlers/      # room:join, room:leave, game:start, guess:submit
│   │       └── dto/           # socket payload schemas (zod)
│   └── shared/
│       ├── types/
│       └── utils/
├── Dockerfile
├── package.json
└── tsconfig.json

frontend/
├── src/
│   ├── components/            # WordGrid, Lobby, PlayerList, ScoreBoard, RoomCodeShare
│   ├── hooks/                 # useSocket, useRoom, useGame
│   ├── pages/                 # Home, CreateRoom, JoinRoom, GameRoom
│   └── lib/                   # socket client setup, api client
├── Dockerfile
├── package.json
└── tsconfig.json

infra/
├── docker-compose.yml         # backend + frontend + redis (mirrors prod topology)
├── docker-compose.dev.yml     # dev overrides: bind mounts, hot reload
├── .dockerignore
├── nginx/
├── env/                       # .env.example per environment (never committed real secrets)
└── ci/                        # lint/typecheck/test/build/push pipelines
```

Root: `package.json` (npm workspaces: `backend`, `frontend`), `CODING_STANDARDS.md`, `.kiro/`, `README.md`.

## Responsibility Boundaries

- **backend/**: all game logic, persistence, real-time protocol, and its own Dockerfile. No UI concerns.
- **frontend/**: all UI/UX and rendering. Talks to backend only through typed HTTP/socket contracts. No business logic (word matching, scoring) duplicated here.
- **infra/**: orchestration, environment/deployment config, and CI only. Changing deployment never requires touching `backend/` or `frontend/` source.

## Backend

- **Framework**: Fastify (preferred) or Express for HTTP (room creation/lookup, health).
- **Real-time**: Socket.io for room state, guess submissions, and broadcasting. Real-time concerns live in `infrastructure`/`presentation` — domain logic stays transport-agnostic.
- **Validation**: `zod` at every boundary (HTTP body, socket event payloads, env vars) — never trust raw client input.
- **Persistence**:
  - **Redis** for live room/game state (players, word index, attempts, scores) — short-lived with TTL cleanup.
  - **Postgres** or a versioned static word list file/SQLite for the BR-PT dictionary. Add a DB only if word-list management needs it.
- **Word resolution authority**: secret word selection, guess validation (correct/in-word/absent), attempt counting, and win determination happen **server-side only**. The client never receives the secret word.
- **Concurrency**: in Championship Mode, "first correct guess scores the point" requires the server to process guesses in strict order per room — no client timestamps.

## Word Dictionary & Matching Rules

- **Fixed length**: every word is exactly **5 letters**. `WordRepository` enforces this at data-load time (fail fast), not per-guess.
- **Accent-insensitive comparison**: feedback compares guess and secret using normalized form (NFD + diacritics stripped, e.g. `á`→`a`, `ç`→`c`) for both green and yellow checks. The original accented spelling is preserved and only sent to the client at reveal time — never used in live comparison.
- **No repeat-avoidance**: `WordRepository.getRandomWord()` has no exclusion list — the same word can appear again in the same session.

## Session Identity & Anti-Abuse

- **Player identity**: long-lived signed `playerId` cookie set on first visit. Opening a second tab reuses the same `playerId` (cookies are browser-scoped).
- **Attempts keyed by `playerId`**: a second socket with an already-active `playerId` is treated as a **reconnect** — it takes over the existing slot rather than creating a new one. This closes the multi-tab extra-attempts exploit and implements reconnect/state-restore in one mechanism.
- **Soft secondary defense**: rate-limit distinct `playerId`s joining the same room from one IP — deterrent, not guarantee (documented limitation).
- **Host migration**: room keeps a join-order succession list. On host disconnect, 30 s grace period for reconnect; if lapsed, host transfers to the longest-connected remaining player (`host:migrated` broadcast).
- **Private room codes**: 8 chars from a 32-symbol CSPRNG alphabet (excludes `0`/`O`, `1`/`I`/`L`); join-by-code path has its own rate limit; codes invalidated when room is torn down.

## Frontend

- **Framework**: React + TypeScript (Vite).
- **Board UI**: grid per player (own board prominent, other players compact — attempt count/colors visible). State is server-authoritative; client renders feedback the server sends.
- **Word input (cursor-based)**: active row tracks a cursor position. Arrow-key and click/tap navigation move the cursor; typing inserts/overwrites at that position. Letter correctness is always server-computed.
- **Styling**: Tailwind CSS or CSS Modules — pick one, don't mix.

## Architecture

Layered/Clean Architecture — `domain` → `application` → `infrastructure` → `presentation`:

| Layer | Responsibility |
|---|---|
| `domain` | Word matching rules, scoring, round/game lifecycle. Zero external imports. |
| `application` | Use cases: create room, join room, submit guess, advance word. |
| `infrastructure` | Socket.io, Redis, word dictionary store. |
| `presentation` | HTTP routes + socket event handlers. |

## Design Patterns

- **Repository**: `RoomRepository` (Redis), `WordRepository` (dictionary) — interfaces in `domain`, implementations in `infrastructure`.
- **Strategy**: `GameMode` interface with `ChampionshipMode` and `RaceMode` implementations. New modes implement the interface; no branching in use-cases.
- **Factory**: `RoomFactory`/`GameFactory` for constructing valid room/game state (assigns secret words, initializes per-player attempt state).
- **Observer/Event Emitter**: domain events (`guess.submitted`, `word.resolved`, `game.ended`) decoupled from socket broadcasting.
- **Adapter**: Socket.io/Redis clients wrapped behind internal interfaces for mockability in tests.

## Conventions

- Files: `kebab-case.ts`. Classes/types: `PascalCase`. Functions/variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Tests co-located as `*.spec.ts` next to the source file they cover.
- One exported concept per file where practical; barrel `index.ts` only at module boundaries (`domain/entities/index.ts`), not throughout.
- Socket event names are namespaced and typed in `backend/src/presentation/sockets/dto`, shared with the frontend via a linked types package or copied contract types — never re-declared ad hoc on the client.
- New game modes are added by implementing `GameMode` in `backend/src/application/game-modes/`, not by branching inside use-cases.
- Word feedback (green/yellow/gray) is always computed in `backend` `domain` and never trusted from or duplicated in `frontend`.

## Containerization

- **Per-package `Dockerfile`**: `backend/Dockerfile` and `frontend/Dockerfile` live next to their code. Neither reaches outside its own directory.
- **Multi-stage builds**: `deps` → `build` → `runtime`. Final image contains only compiled output and production `node_modules`.
- **Base image**: pinned `node:<lts>-alpine` (never `latest`); frontend runtime uses pinned `nginx:<version>-alpine`.
- **Reproducible installs**: `npm ci` from committed lockfile.
- **Non-root user**: runtime containers run as `USER node`.
- **Small surface area**: `.dockerignore` excludes `node_modules`, `.git`, `dist`, `.env*`, test files.
- **Signal handling**: `NODE_ENV=production` set explicitly; Node receives signals directly (no shell-form `CMD`) for graceful shutdown.
- **Healthcheck**: backend hits `/health`; frontend Nginx serves a static healthcheck endpoint.
- **No secrets in images**: all config via env vars injected at runtime from `infra/env/.env.example`.
- **Orchestration in `infra/`**: `docker-compose.yml` wires `backend` + `frontend` + Redis (pinned, e.g. `redis:7-alpine`). `docker-compose.dev.yml` adds bind mounts/hot-reload without replacing the base topology.
- **Image versioning**: tag with commit SHA or semver, not `latest`.

## Testing

- **Unit**: Vitest or Jest for `domain`/`application` — word-matching/feedback logic, attempt limits, scoring, win conditions for both modes.
- **Integration**: repository tests against real (containerized) Redis.
- **E2E/real-time**: Socket.io client-driven tests simulating multi-player rooms (join, concurrent guesses, first-correct-guess race in Championship, first-to-finish in Race).

## Tooling

- ESLint (`@typescript-eslint`) + Prettier, pre-commit hook.
- Conventional Commits.
- CI gate: type-check, lint, test before merge.

## Common Commands

```bash
npm run dev        # start dev server (API + sockets)
npm run build      # compile TypeScript
npm run test       # run unit/integration tests
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
