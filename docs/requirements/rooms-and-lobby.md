# Rooms & Lobby

## Overview

A room is the unit of multiplayer play: a host creates one (public or private), players join by code, the host configures settings and starts the match. Rooms live in Redis with a hard TTL and are cleaned up eagerly where possible.

## Business Requirements

1. Anyone can create a room without an account — just a chosen nickname.
2. A room is either **public** (listed for anyone to browse and join) or **private** (joinable only via its code/link).
3. A private room holds up to **50 players**.
4. Joining a room requires only a nickname and the room code — no signup.
5. A player can be an active member of **only one room at a time**. Joining a second room silently removes them from the first; if that vacated room drops to 0 players, it is deleted immediately rather than waiting for expiry.
6. The lobby (pre-game) shows the current player list, tags the host and "you", and lets the host edit settings before starting:
   - Word count: 1-15 (default 5)
   - Attempts per word (Championship only): 1-10 (default 6)
   - Time limit per word: 30 seconds to 10 minutes (stored as milliseconds, not shown to the user)
7. Only the host can change settings or start the game, and only while the room is still in its lobby.
8. **Host migration** has two different behaviors depending on how the host leaves:
   - If the host voluntarily leaves the room, a new host (the next player in the room) is assigned **immediately**, no delay.
   - If the host's connection drops **mid-game** (not voluntarily leaving), the room waits **30 seconds** for them to reconnect before migrating host to another player. Reconnecting within that window cancels the migration and the same player stays host.
9. A player whose connection drops while still in the lobby is removed from the room right away — there's no grace period in the lobby, only mid-game.
10. A player who disconnects mid-game (and is not the host) is not removed — their seat is preserved so they can reconnect and resume.
11. A room and its player-to-room mapping automatically expire after **6 hours** of existence, regardless of activity.

## Technical Requirements

1. Room creation: `POST /rooms` (`backend/src/presentation/http/routes/rooms.ts`) → `create-room.ts` (`backend/src/application/use-cases/room/create-room.ts`). Builds `RoomSettings` (`backend/src/domain/value-objects/room-settings.ts`, bounds enforced in `BOUNDS`), instantiates the selected `GameMode` (Championship or Race), registers it in a process-local `GameModeRegistry`, and persists a `RoomRecord` via `RoomRepository`. Public rooms are additionally indexed in the Redis set `rooms:public-lobbies`.
2. Join/leave happen over **Socket.IO**, namespaced `/championship` and `/race` (wired in `backend/src/index.ts`), not HTTP. `join-room.ts` and `leave-room.ts` both run inside `withRoomLock` (`backend/src/infrastructure/realtime/room-lock.ts`) — an in-process promise-chain mutex per room code. This only works because game-mode state (`GameModeRegistry`) is itself process-local; see [infra-and-deployment.md](infra-and-deployment.md) for why room codes must route stickily to one backend instance.
3. Capacity: `MAX_PLAYERS_PER_ROOM = 50` (`backend/src/domain/repositories/room-repository.ts`), enforced in `join-room.ts` (`RoomFullError` otherwise).
4. Single-room membership: `join-room.ts`'s `leavePreviousRoom()` reads `player-room:<playerId>` from Redis and, if it points elsewhere, runs the same `leaveRoom` flow on that room first.
5. Host migration:
   - Voluntary: `leave-room.ts` reassigns host to `players[0]` immediately when the leaving player is host.
   - Involuntary: the `disconnect` handler in `register-championship-mode-handlers.ts` / `register-race-mode-handlers.ts` calls `HostMigrationTracker.onHostDisconnected` (`backend/src/infrastructure/realtime/host-migration-tracker.ts`) only when `record.status !== 'lobby'`; a 30s timer runs `migrate-host.ts` unless cancelled by a reconnect.
   - A disconnect while `status === 'lobby'` always runs a full synchronous `leaveRoom()`, host or not — no grace period.
6. TTL: `redis-room-repository.ts` writes `room:<code>` and `player-room:<playerId>` with a 6-hour `EX` at creation; subsequent saves use `KEEPTTL` (never refreshed by activity).
7. Zombie rooms: no background sweep. Detected lazily on the next `join-room.ts` attempt — if the in-process `GameModeRegistry` entry is missing but the Redis record says `lobby`, the stale record is deleted and the join fails with `RoomNotFoundError`. A mid-game zombie room is left for its TTL to expire.
8. Room settings: `update-room-settings.ts` (HTTP `PATCH /rooms/:code/settings` and socket `room:settings:update`), host-only and lobby-only, live-propagates into the running `GameMode` via `updateOptions()`.
9. Room codes: 8 characters from alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (`backend/src/domain/value-objects/room-code.ts`), but the **first character is forced to the backend instance's `instanceTag`** for sticky routing — so only **7 characters are actually random**. Generation retries up to 5x on collision.
10. Frontend: `frontend/src/hooks/useLobby.ts` owns the lobby socket connection, player list, and settings/start/leave actions; `components/Lobby.tsx` and `components/PublicRoomBrowser.tsx` (a polling `GET /rooms` list with manual refresh) render it.

## Acceptance Criteria

- [ ] Creating a room without an account produces a joinable code/link.
- [ ] A 51st join attempt to a full private room is rejected.
- [ ] Joining room B while active in room A removes the player from room A; if A is now empty, A no longer exists.
- [ ] Non-host players cannot change settings or start the game.
- [ ] Host voluntarily leaving reassigns host with no visible delay.
- [ ] Host's connection dropping mid-game keeps the room on the same host if they reconnect within 30s, otherwise migrates.
- [ ] A non-host disconnecting mid-game does not remove them or shrink the player list; they can resume by rejoining with the same identity.
- [ ] A room becomes unjoinable after 6 hours regardless of how active it was.

## Known Issues / Cleanup Notes

- Room code entropy is lower than it looks: `.kiro/steering/tech.md` describes "8 chars from a CSPRNG alphabet" without mentioning that one is a fixed instance tag, not random. Worth deciding deliberately in the rewrite (e.g. a config value instead of baking routing into the code's character set).
