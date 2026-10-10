# termo.io

A competitive, real-time multiplayer word-guessing game in Brazilian Portuguese — think Wordle, but up to 50 players race each other in the same room.

---

## Features

- **Two multiplayer modes** — Championship (per-word scoring, fewest-attempts wins, tie-break on a final tie) and Race (infinite attempts, first to finish all words without ever timing out wins)
- **Three daily singleplayer puzzles** — Termo, Dueto, and Quarteto, same secret word(s) for every player worldwide each day, no room/account needed, reachable from the global navbar
- **Instant play** — join with a nickname and room code, no account required
- **Real-time shared board** — every player's guesses, attempt counts, and letter feedback are visible to everyone as they happen
- **Accent-insensitive input** — typing plain letters matches accented secret letters (e.g. `a` matches `ã`, `c` matches `ç`)
- **Flexible letter input** — click any cell or use arrow keys to position the cursor before typing
- **Private rooms** — share a generated room code with friends (up to 50 players)
- **Host-controlled restart** — after a game ends, the host starts a new match with a 10-second countdown; the room and its players carry over
- **Reconnect-safe** — refreshing mid-game restores your board state and remaining attempts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Kotlin, Quarkus 3.40 (LTS), Java 21 |
| API contract | OpenAPI 3.0 (spec-first codegen: JAX-RS interfaces + models) |
| Real-time contract | AsyncAPI 3.0 over native WebSockets (Quarkus WebSockets Next) |
| Cache / State | Redis 7 |
| Containerization | Docker, Docker Compose |

Architecture follows layered/clean architecture: `domain` → `application` → `infrastructure` → `presentation`. All game logic (word matching, scoring, win conditions) lives server-side — the client never receives secret words or computes feedback locally.

### API-first

The REST contract is authored **before** the code and treated as the source of truth:

- **Spec**: [`backend/src/main/resources/META-INF/openapi.yaml`](backend/src/main/resources/META-INF/openapi.yaml) — hand-written, OpenAPI 3.0.
- **Generated**: the build runs `openapi-generator-maven-plugin` (jaxrs-spec) to produce JAX-RS API interfaces and models under `target/generated-sources/openapi`; the `*ApiImpl` classes implement the generated interfaces and only map the domain to/from generated models. Changing the spec regenerates the contract on the next build.
- **Served**: `GET /q/openapi` (JSON or YAML via content negotiation) and interactive docs at `/q/swagger-ui`.
- **WebSockets**: specified separately in [`backend/src/main/openapi/asyncapi.yaml`](backend/src/main/openapi/asyncapi.yaml) (AsyncAPI 3.0), since OpenAPI cannot describe the `/ws/*` event contract.

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- JDK 21 + Maven 3.9.16 (or the bundled `backend/mvnw`) for local dev without Docker
- Node.js LTS + npm (for the frontend and e2e suite)

### Run with Docker (recommended)

```bash
git clone https://github.com/your-org/termo.io.git
cd termo.io
docker compose up --build
```

This starts two backend instances (`backend_a`/`backend_b`) behind an nginx gateway with sticky routing by room code, plus Redis and the frontend — see `docs/requirements/infra-and-deployment.md` for the full topology.

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run locally

```bash
# Install dependencies (from repo root)
npm install

# Start Redis (requires Docker)
docker run -d -p 6379:6379 redis:7-alpine

# In one terminal — backend (port 4000)
npm run dev:backend

# In another terminal — frontend (port 5173)
npm run dev:frontend
```

---

## Project Structure

```
termo.io/
├── backend/          # Kotlin + Quarkus server (spec-first REST + WebSockets Next)
│   ├── src/main/kotlin/io/termo/
│   │   ├── domain/           # Word matching, scoring, game rules
│   │   ├── application/      # Use cases + game-mode strategies (incl. daily modes)
│   │   ├── infrastructure/   # Redis, word dictionary, timers, session store
│   │   └── presentation/     # Generated API impls, WebSocket endpoints, DTOs
│   ├── src/main/resources/META-INF/openapi.yaml  # REST contract (codegen source of truth)
│   └── src/main/openapi/asyncapi.yaml            # WebSocket contract
├── frontend/         # React + Vite UI
│   └── src/
│       ├── components/       # WordGrid, Keyboard, Lobby, PlayerBoard, DailyGameRoom, DailyModeBar...
│       └── hooks/            # useGame, useRaceGame, useDailyGame, useGuessInput...
├── e2e/              # Playwright end-to-end suite (see below), runs via Docker
├── nginx/            # Gateway config (sticky routing across the two backend instances)
├── docs/requirements/ # Per-feature business + technical requirements docs (see below)
└── docker-compose.yml # backend_a/backend_b + nginx gateway + frontend + redis
```

---

## Game Modes

### Championship Mode
- 5 words per game by default (room-configurable 1-15), up to **6 attempts** per word by default (configurable 1-10)
- The **fewest-attempts solver** of each word earns the point — not first-to-solve; the word stays open until every eligible player finishes
- If no one guesses within the attempt limit, every eligible player gets 2 bonus attempts
- Highest score after all words wins; a final tie triggers a **tie-break round** (3 attempts, 2 minutes) between just the tied players

### Race Mode
- 5 words per game by default, **unlimited attempts** per word (but each word still has a time limit)
- **First player to correctly guess every word, having never timed out on any of them, wins**
- Mid-race UI is intentionally minimal — no attempt counters or word-resolved banners while the race is live; all results are revealed together at the end

### Daily Games — Termo, Dueto, Quarteto
- Solo puzzles, no room or account needed — same secret word(s) for every player worldwide each calendar day
- **Termo**: 1 word / 6 attempts · **Dueto**: 2 words / 7 attempts (one guess checked against both boards at once) · **Quarteto**: 4 words / 9 attempts
- Stats, streaks, and history are tracked locally in your browser only

For full business + technical detail on any of the above, see [`docs/requirements/`](docs/requirements/README.md).

---

## Common Commands

```bash
npm run dev:backend      # start backend dev server (hot reload)
npm run dev:frontend     # start frontend dev server (hot reload)
npm run build            # build both packages
npm run typecheck        # tsc --noEmit across all packages
npm run test             # run unit tests (Vitest)
npm run test:e2e         # run the full Playwright e2e suite (see below)
```

---

## End-to-End Tests

`e2e/` is a Playwright suite (`e2e/tests/max-players.spec.ts`) that drives both game
modes at the room's maximum size (50 players) through a full match — lobby, gameplay,
tie-break (campeonato only), and the final placar modal — taking a screenshot at each
stage into `e2e/screenshots/{corrida,campeonato}/`.

It runs entirely inside Docker (`e2e/docker-compose.yml`: redis + backend + frontend +
a Playwright-bundled runner on one network), so nothing needs to be installed on the
host beyond Docker itself:

```bash
npm run test:e2e
# or directly:
bash e2e/run.sh
```

Useful overrides (e.g. for a fast smoke run before a full 50-player pass):

```bash
E2E_PLAYER_COUNT=4 E2E_TEST_TIMEOUT_MS=180000 bash e2e/run.sh
```

The backend accepts an opt-in `E2E_FIXED_WORDS` env var (comma-separated secret words,
consumed in draw order) so the suite can know secret words in advance and force a
deterministic tie-break — `run.sh` computes and passes this automatically.

---
## TODO
- ranqueada (?)
- no fim aparecer quantas tentativas a pessoa tentou (end-of-game scoreboard currently shows who solved each word, not attempt counts)

## Environment Variables

See `docker-compose.yml` (repo root) for the full set wired up per service. Never commit real secrets.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend HTTP/Socket.io port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `REDIS_URL` | `redis://localhost:6379` (local) / `redis://redis:6379` (Docker) | Redis connection string |
| `INSTANCE_TAG` | `A` | Selects this backend instance's room-code prefix for nginx sticky routing (see `docker-compose.yml` / `nginx/nginx.conf`) |
| `E2E_FIXED_WORDS` | unset | Comma-separated secret words, consumed in draw order — lets the e2e suite force deterministic word draws. Set automatically by `e2e/run.sh`, not used in normal dev/prod |

The backend also runs global rate limiting (100 req/min/IP, tighter per-route limits on room creation/lookup and daily-guess submission) and standard security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) — see `docs/requirements/session-identity-and-security.md`.

---

## Contributing

1. Fork the repo and create a feature branch
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
3. Ensure `npm run typecheck` and `npm run test` pass before opening a PR
4. PRs that bypass these checks will not be merged

---

## License

MIT
