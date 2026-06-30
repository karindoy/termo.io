---
inclusion: always
---

# Project Structure

Monorepo split into three top-level responsibilities — **backend**, **frontend**, **infra** — each independently buildable/deployable. The backend internally follows layered/clean architecture: dependencies point inward, `domain` has zero external imports, everything else depends on it, never the reverse.

```
backend/
├── src/
│   ├── domain/
│   │   ├── entities/          # Room, Player, Game, Word, Attempt, Score
│   │   ├── value-objects/      # GuessFeedback (per-letter green/yellow/gray, accent-insensitive), NormalizedLetter, RoomCode, RoomSettings (word count/attempts/timer), PlayerIdentity
│   │   ├── repositories/       # RoomRepository, WordRepository (interfaces only)
│   │   └── errors/             # RoomFullError, RoomNotFoundError, InvalidGuessError, AttemptsExceededError, InvalidRoomSettingsError
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── room/            # create-room, join-room, leave-room, list-public-rooms, migrate-host
│   │   │   └── game/            # start-game, submit-guess, advance-to-next-word, end-game, resolve-tie-break
│   │   └── game-modes/          # GameMode strategy interface + ChampionshipMode, RaceMode implementations
│   │
│   ├── infrastructure/
│   │   ├── persistence/
│   │   │   ├── redis/           # RoomRepository impl, live game/attempt state, TTL cleanup
│   │   │   └── words/             # WordRepository impl (dictionary file/table for BR-PT words)
│   │   ├── realtime/             # Socket.io server setup, event adapters
│   │   └── config/                # env loading, DI/composition root
│   │
│   ├── presentation/
│   │   ├── http/
│   │   │   ├── routes/           # public-rooms list, health
│   │   │   ├── controllers/
│   │   │   └── middlewares/      # error-handler, validation (zod), rate-limit
│   │   └── sockets/
│   │       ├── handlers/         # room:join, room:leave, game:start, guess:submit
│   │       └── dto/              # socket payload schemas (zod)
│   │
│   └── shared/
│       ├── types/
│       └── utils/
├── Dockerfile                  # multi-stage build, owned by backend
├── package.json
└── tsconfig.json

frontend/
├── src/
│   ├── components/           # WordGrid (own + other players), Lobby, PlayerList, ScoreBoard, RoomCodeShare
│   ├── hooks/                  # useSocket, useRoom, useGame
│   ├── pages/                  # Home, CreateRoom, JoinRoom, GameRoom
│   └── lib/                     # socket client setup, api client
├── Dockerfile                  # multi-stage build (build → static Nginx serve), owned by frontend
├── package.json
└── tsconfig.json

infra/
├── docker-compose.yml          # orchestrates backend + frontend + redis (mirrors prod topology)
├── docker-compose.dev.yml      # dev overrides: bind mounts, hot reload, exposed debug ports
├── .dockerignore                # shared ignore rules referenced by both Dockerfiles
├── nginx/                        # reverse proxy / static-serving config (if used)
├── env/                          # .env.example per environment (never committed real secrets)
└── ci/                           # CI pipeline definitions (lint/typecheck/test/build/push)
```

Root holds only cross-cutting files: `package.json` (npm workspaces: `backend`, `frontend`), `CODING_STANDARDS.md`, `.kiro/`, `README.md`.

## Responsibility Boundaries

- **backend/**: owns all game logic, persistence, real-time protocol, and its own Dockerfile/build. No UI concerns.
- **frontend/**: owns all UI/UX and rendering. Talks to backend only through the typed HTTP/socket contracts exposed by `backend/src/presentation`. No business logic (word matching, scoring) duplicated here — render what the server sends.
- **infra/**: owns orchestration, environment/deployment config, and CI — not application code. Changing how something is *deployed* should never require touching `backend/` or `frontend/` source.

## Conventions

- Files: `kebab-case.ts` (`room-repository.ts`). Classes/types: `PascalCase`. Functions/variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Tests co-located as `*.spec.ts` next to the source file they cover, within each package.
- One exported concept per file where practical; barrel `index.ts` files only at module boundaries (e.g. `domain/entities/index.ts`), not throughout.
- Socket event names are namespaced and typed in `backend/src/presentation/sockets/dto` and shared with the frontend via a published/linked types package (or copied contract types) — never re-declared ad hoc on the client.
- New game modes are added by implementing the `GameMode` strategy interface in `backend/src/application/game-modes/` (currently `ChampionshipMode`, `RaceMode`), not by branching inside use-cases.
- Word feedback (green/yellow/gray) is always computed in `backend` `domain` and never trusted from or duplicated in `frontend`.
