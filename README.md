# termo.io

A competitive, real-time multiplayer word-guessing game in Brazilian Portuguese — think Wordle, but up to 50 players race each other in the same room.

---

## Features

- **Two game modes** — Championship (per-word scoring, 6 attempts) and Race (infinite attempts, first to finish all 5 words wins)
- **Instant play** — join with a nickname and room code, no account required
- **Real-time shared board** — every player's guesses, attempt counts, and letter feedback are visible to everyone as they happen
- **Accent-insensitive input** — typing plain letters matches accented secret letters (e.g. `a` matches `ã`, `c` matches `ç`)
- **Flexible letter input** — click any cell or use arrow keys to position the cursor before typing
- **Private rooms** — share a generated room code with friends (up to 50 players)
- **Auto-restart** — a new match begins automatically 5 seconds after each game ends
- **Reconnect-safe** — refreshing mid-game restores your board state and remaining attempts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Fastify, TypeScript |
| Real-time | Socket.io |
| Cache / State | Redis 7 |
| Containerization | Docker, Docker Compose |

Architecture follows layered/clean architecture: `domain` → `application` → `infrastructure` → `presentation`. All game logic (word matching, scoring, win conditions) lives server-side — the client never receives secret words or computes feedback locally.

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- Node.js LTS + npm (for local dev without Docker)

### Run with Docker (recommended)

```bash
git clone https://github.com/your-org/termo.io.git
cd termo.io
docker compose -f infra/docker-compose.yml up --build
```

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
├── backend/          # Fastify + Socket.io server, clean architecture
│   └── src/
│       ├── domain/           # Word matching, scoring, game rules
│       ├── application/      # Use cases + game-mode strategies
│       ├── infrastructure/   # Redis, word dictionary, Socket.io setup
│       └── presentation/     # HTTP routes, socket handlers, DTOs
├── frontend/         # React + Vite UI
│   └── src/
│       ├── components/       # WordGrid, Keyboard, Lobby, PlayerBoard
│       └── hooks/            # useGame, useRaceGame, useSocket
└── infra/            # Docker Compose, Nginx, env examples, CI config
```

---

## Game Modes

### Championship Mode
- 5 words per game, up to **6 attempts** per word
- **First player to guess a word** earns a point
- If no one guesses within 6 attempts, every eligible player gets 2 bonus attempts
- Highest score after 5 words wins

### Race Mode
- 5 words per game, **unlimited attempts**
- **First player to correctly guess all 5 words wins**
- Mid-race UI is intentionally minimal — no attempt counters or word-resolved banners while the race is live; all results are revealed together at the end

---

## Common Commands

```bash
npm run dev:backend      # start backend dev server (hot reload)
npm run dev:frontend     # start frontend dev server (hot reload)
npm run build            # build both packages
npm run typecheck        # tsc --noEmit across all packages
npm run test             # run unit tests (Vitest)
```

---

## Environment Variables

Copy `infra/env/.env.example` and adjust as needed. Never commit real secrets.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend HTTP/Socket.io port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |

---

## Contributing

1. Fork the repo and create a feature branch
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
3. Ensure `npm run typecheck`, `npm run test`, and `npm run lint` all pass before opening a PR
4. PRs that bypass these checks will not be merged

---

## License

MIT
