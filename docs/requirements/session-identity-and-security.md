# Session Identity & Security

## Overview

How a player is identified without an account, how control of a room seat is authorized, and how the API is protected from abuse.

## Business Requirements

1. No account or password is ever required to play.
2. A player's identity persists across page reloads on the same device/browser (so refreshing doesn't make them "a new player"), but is not portable to another device or browser.
3. Only the player who actually holds a room seat can perform privileged actions on it (leaving, changing settings, starting, restarting, guessing) — nobody can impersonate another player's seat just by knowing their nickname or ID.
4. Excessive requests from a single source are throttled to protect the service — room creation and lookups are limited more tightly than general traffic, and daily-puzzle guesses have their own limit.

## Technical Requirements

1. `playerId` is a client-supplied string (1-64 chars, `frontend/src/lib/player-identity.ts` mints a `crypto.randomUUID()` into `localStorage`) — not a cookie, no server-issued long-lived identity.
2. Authority comes from a **session secret**, not the `playerId` itself: on `room:join`, `PlayerSessionStore.issue(code, playerId)` mints a per-room, per-player UUID sent back once via `room:session`. Every privileged action afterward (`room:leave`, `room:settings:update`, `room:start`, `room:restart`, `guess:submit`) must present that same secret; `sessionStore.verify(code, playerId, secret)` rejects the call otherwise. The secret is never included in any broadcast payload — only the acting player ever sees it.
3. Production session storage is **`RedisPlayerSessionStore`** (`backend/src/infrastructure/realtime/redis-player-session-store.ts`, key `session:<code>`, 6h TTL mirroring room TTL) — actually composed in `backend/src/index.ts`. An `InMemoryPlayerSessionStore` (`infrastructure/realtime/player-session-store.ts`) also exists as an alternate implementation, used in tests, but is **not** what runs in production.
4. Sessions are lost on refresh (in-memory secret held client-side only) — a fresh one is reissued on the next `room:join`, which is why reconnect-on-refresh transparently resumes a seat: re-emitting `room:join` with the same `playerId` for an already-present player bypasses lobby/full-room checks and just re-issues a session + replays current state.
5. Rate limiting (`@fastify/rate-limit`, configured inline per-route in `backend/src/index.ts` and route files — there is no separate `middlewares/rate-limit.ts`):
   - Global: 100 requests/min/IP.
   - `POST /rooms` (create): 10/min/IP.
   - `GET /rooms/:code` (lookup): 20/min/IP.
   - `POST /daily/:mode/guess`: 60/min/IP.
   - There is no per-`playerId`-per-IP limit on socket joins.
6. `@fastify/helmet` is registered globally for standard HTTP security headers.
7. Room code entropy ties into this: see [rooms-and-lobby.md](rooms-and-lobby.md) — first character of an 8-char code is a fixed instance tag, not random.

## Acceptance Criteria

- [ ] A player cannot perform a privileged action on a seat without the session secret issued for that specific room+player.
- [ ] Refreshing the page and rejoining the same room with the same `playerId` resumes the same seat.
- [ ] A session secret is never visible in any payload broadcast to other players.
- [ ] Repeated room-creation attempts beyond 10/min from one IP are rejected.
- [ ] Repeated daily-guess submissions beyond 60/min from one IP are rejected.

## Known Issues / Cleanup Notes

- `.kiro/steering/tech.md` states "Sessions live in-memory only (`Map`, not Redis)" — this is stale. Production actually uses `RedisPlayerSessionStore`; the in-memory version is a secondary implementation used for tests, not what's running.
- `tech.md`'s project-structure diagram implies a dedicated `presentation/http/middlewares/rate-limit.ts` file — no such file exists; rate limiting is configured inline per-route.
