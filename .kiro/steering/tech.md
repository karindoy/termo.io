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
│   ├── components/            # WordGrid, Keyboard, Lobby, PlayerBoard, PlacarModal
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

- **Player identity**: `playerId` is a client-supplied string (1–64 chars), not a cookie — there is no server-issued long-lived identity. Authority instead comes from a **session secret**: on `room:join`, `PlayerSessionStore.issue(code, playerId)` (`infrastructure/realtime/player-session-store.ts`) mints a per-room, per-player UUID, sent back once via `room:session`. Every privileged action after that (leave, settings, start, guess) must present that same secret; `sessionStore.verify(code, playerId, secret)` rejects the call otherwise. The secret is never included in any broadcast payload — `playerId`/nickname are public (visible to the whole room, and to public-lobby browsers), the secret is the only thing that proves control of a seat. Sessions live in-memory only (`Map`, not Redis) and are cleared when the room is deleted.
- **No auto-reconnect-to-slot**: rejoining a room does not implicitly take over a previous seat — the client must still hold the original session secret to act as that player again. Losing the secret (e.g. clearing local storage) means losing control of that seat, though the seat itself isn't freed until the room/player-room TTL lapses or the room empties.
- **Single-room membership**: `join-room.ts` calls `leavePreviousRoom()` on every join — it looks up `player-room:<playerId>` in Redis and, if it points at a different room, runs the same `leaveRoom` flow on it before completing the new join. The vacated room gets a `lobby:state` (+ `host:migrated` if applicable) broadcast; if it drops to 0 players it's deleted immediately, not left for TTL.
- **Zombie players**: a non-host player whose socket disconnects mid-game is **not** removed — they stay in `room.players` with a dead socket until the game ends or the room's TTL expires. Only two disconnect cases are acted on immediately: (1) disconnect while the room is still in `lobby` status → full `leaveRoom()`, freeing the slot and possibly deleting the room; (2) the **host** disconnecting mid-game → starts the 30 s migration grace period below. Any other in-game disconnect is inert by design (the player may reconnect and resume with their session secret).
- **Zombie rooms**: a Redis room record can outlive its in-memory `GameModeRegistry` entry (e.g. after a server restart, since the registry is process-local and Redis persists). This is only detected lazily, on the next join attempt: if the registry entry is missing and the room is still `lobby`, the stale record is deleted and the join fails with `RoomNotFoundError`; if the room was mid-game, the record is left in place for its TTL to expire — there is no background sweep.
- **Room/session TTL**: room records and `player-room:<playerId>` mappings are both written with a flat **6-hour TTL** (`EX`) at creation; subsequent saves use `KEEPTTL`, so the TTL is never refreshed by activity — a room is hard-capped at 6 h of life regardless of how active it stays.
- **Host migration — two paths, not one**: a **voluntary** `room:leave` by the host reassigns the host **immediately** (no grace period) to `players[0]` after removal. An **involuntary** disconnect while a game is in progress instead starts a **30 s grace timer** (`HostMigrationTracker`, `infrastructure/realtime/host-migration-tracker.ts`); if the host reconnects in time the timer is cancelled, otherwise `migrateHost()` picks the first remaining player in the room's `players` array (join order, but can drift after players leave/rejoin — not an explicit succession list) and broadcasts `host:migrated`.
- **Rate limiting**: global Fastify limit of 100 req/min/IP; `POST /rooms` (create) capped at 10/min/IP; `GET /rooms/:code` (lookup by code) capped at 20/min/IP. There is **no** per-`playerId`-per-IP limit on socket joins.
- **Private room codes**: 8 chars from a 31-symbol CSPRNG alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (excludes `0`, `1`, `I`, `L`, `O`); generation retries up to 5× on collision; codes stop resolving once the room record is deleted (explicit empty-room delete, zombie-room delete on stale join, or TTL expiry).

## Frontend

- **Framework**: React + TypeScript (Vite).
- **Board UI**: grid per player (own board prominent, other players compact — attempt count/colors visible). State is server-authoritative; client renders feedback the server sends.
  - **Word grid (`components/WordGrid.tsx`)**: one instance per player. Renders a stack of word-rows: one per submitted attempt, then (own grid only, while `canGuess`) one live active-input row, then empty placeholder rows padded up to `totalRows`.
    - **Word row (`.word-row`)**: `wordLength` `Tile` cells per row.
      - *Resolved row* (past attempt): tiles show the guessed letter + server feedback status (`correct`/`present`/`absent`), revealed via a per-column flip animation staggered 80ms apart; newly-added attempts flip in ~450ms after arriving instead of rendering already-resolved.
      - *Active row* (own grid only, current player only): editable — shows in-progress letters at their typed positions, highlights the cursor cell (`isCursor`), pops the most recently edited cell (`isTyping`), and cells are clickable to move the cursor (`onActiveCellClick`). Other players never get an active row — the server never exposes anyone's in-progress typing, only completed attempts.
      - *Placeholder row*: empty tiles rendered ahead of time purely to reserve vertical space.
    - **Own grid vs. other players' grids**: the own ("my-word") grid has no fixed `totalRows` — it only grows to `attempts.length` (+1 active row) as the player plays. Other players' grids (via `PlayerBoard`) always pass a fixed `totalRows` (Championship: current round's `maxAttempts`, default 6; Race: hardcoded 6) so every attempt row is pre-rendered from the start and the other-players panel never shifts layout as guesses come in.
    - **Guess-stat badges (`.guess-stats`)**: rendered above the grid whenever both `correctWords` and `wrongWords` are supplied — true for every grid, own and others'. Two pills: `guess-stat-correct` (green, just the count) and `guess-stat-wrong` (`✕ N`); both replay a "pop" animation on change (re-keyed by value). Semantics differ by mode but are always a running tally, never reset mid-game:
      - *Championship*: sourced from `playerStats` in `useGame` — incremented once per resolved word for every player in the room simultaneously: the word's winner gets `+1 correct`, everyone else gets `+1 wrong`.
      - *Race*: sourced from `sessionStats` (derived from `revealHistory`) in `useRaceGame` — one entry is appended per player per word as each player individually finishes it (`player:word-resolved`); `reason === 'solved'` → `+1 correct`, otherwise `+1 wrong`. These tallies update live for every player throughout the race — unlike the round-status/banner UI, which is deliberately hidden until the end-of-race summary.
- **Word input (cursor-based)**: active row tracks a cursor position. Arrow-key and click/tap navigation move the cursor; typing inserts/overwrites at that position. Letter correctness is always server-computed.
  - **`hooks/useGuessInput.ts`**: owns the active row's letter buffer/cursor, independent of `WordGrid`. Its internal reset effect keys on `[wordLength, resetKey]` — `wordLength` alone doesn't change between rounds (always 5), so callers **must** pass a `resetKey` that changes every time the target word advances (Championship: `round.roundSequence`; Race: the player's own `wordIndex`), otherwise leftover letters/cursor position from the previous word persist into the new row.
- **Keyboard (`components/Keyboard.tsx`)**: on-screen QWERTY layout, 3 rows (`QWERTYUIOP` / `ASDFGHJKL` / `ZXCVBNM`), no accented keys — accent-insensitive matching means only plain letters are ever needed. Wide `Backspace` key on row 2, wide `Enviar` (submit) key on row 3. Each key is colored by the best-known status for that letter across all of the player's attempts so far (`correct` > `present` > `absent` priority; unplayed letters are unstyled). Physical keyboard input is supported in parallel: plain `a`-`z` types a letter, `Enter` submits, `Backspace` deletes, `ArrowLeft`/`ArrowRight` move the cursor — wired via a `window` `keydown` listener, not the on-screen `<button>`s. The keyboard is permanently anchored to the bottom of the screen across all game modes and screen sizes.
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
