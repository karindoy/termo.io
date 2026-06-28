---
inclusion: always
---

# Planning Overview

**termo.io** — a competitive, multiplayer Brazilian Portuguese word-guessing game (Wordle-style, "Termo") played in rooms.

Players guess hidden Brazilian Portuguese words. Each room plays a sequence of words. Feedback per guess uses standard Wordle-style coloring:

- **Green**: correct letter in the correct position.
- **Yellow**: correct letter, wrong position.
- **Gray**: letter not in the word (implicit — absence of green/yellow).

All players in a room see each other's nickname, attempts, letter colors, and positions in real time — guesses are not private, the board is shared/visible to everyone.

Delivery is phased so each phase ships something playable end-to-end (backend + frontend + infra) before adding the next layer of complexity. No phase is "frontend-only" or "backend-only" — see `structure.md` for the backend/frontend/infra split each phase touches.

---

## Phase 1 — Single Word, Walking Skeleton

**Status: done.** `SingleWordMode` (`backend/src/application/game-modes/single-word-mode.ts`) plus the Phase 1 socket handlers/frontend grid still exist as the throwaway scaffolding described below; `backend/src/index.ts` has since moved on to wiring `RoundMode` (Phase 2) as the live mode.

**Goal**: prove the full stack end-to-end with the simplest possible game — one secret word, one room, no modes, no auth.

- No game mode selection — only **1 word** per game.
- One room type (no public/private distinction yet).
- Backend + frontend + infra all stood up; **no automated tests yet** (deliberate — this phase is throwaway-quality scaffolding to validate plumbing, not the final domain model).

**Deliverables**:
- `backend`: minimal domain (`Word`, `Attempt`, `GuessFeedback`), one use-case (`submit-guess`), Socket.io broadcast of feedback, server-side word resolution.
- `frontend`: word grid, on-screen/keyboard input, render green/yellow/gray feedback from server.
- `infra`: `docker-compose.yml` running backend + frontend + Redis locally.

**Acceptance**: two browser tabs can join the same hardcoded room, submit guesses, and see correct color feedback for both players.

**Design note (anticipates Phase 2/3 without rewriting)**: even though only one mode exists, the single-word logic should sit behind the `GameMode` interface (see `tech.md` Strategy pattern) from the start — Phase 1 ships a `SingleWordMode` implementation. This is the Open/Closed Principle in practice: Phase 2/3 add new `GameMode` implementations, they don't modify Phase 1's use-case code.

---

## Phase 2 — Round Mode

**Status: done.** `Game`/`WordRound` (`backend/src/domain/entities/`) and `RoundMode` (`backend/src/application/game-modes/round-mode.ts`) implement all rules below and are wired as the active mode in `backend/src/index.ts`. 19 backend tests pass — `word-round.spec.ts` and `game.spec.ts` cover round transitions, scoring, and the full tie-break flow (including "nobody solves the penalty word, deal another"); `round-mode.spec.ts` adds the timer-expiry path (via `vi.useFakeTimers`) and the concurrent-guess race (two "simultaneous" guesses land correctly on old/new rounds thanks to Node's run-to-completion model — see the note in that test file). Frontend (`frontend/src/hooks/useGame.ts`, `frontend/src/components/{ScoreBoard,RoundStatus,WordRevealBanner}.tsx`) adds the scoreboard, word-index/timer/attempts-remaining indicator, a timed word-reveal banner, tie-break spectator gating, and a game-finished screen; both packages typecheck and build clean.

Two items from the deliverables below are intentionally deferred, not missing by oversight:
- **`PenaltyTieBreak` use-case**: the logic lives in `Game.advanceTieBreak`/`Game.resolveCurrentRound` rather than its own use-case file — revisit if/when tie-break rules need to vary independently of round resolution.
- **Redis Lua/`MULTI`+`WATCH` atomicity** (see ACID section below): not implemented — the game still runs as a single in-process room, so the synchronous, single-threaded JS event loop already gives the same guarantee. This becomes a real requirement once room state moves to Redis for horizontal scaling (Phase 4+), not before.

- 5 words per game.
- Each word allows a **maximum of 6 attempts** per player.
- For each word, the **first player to guess correctly scores a point**.
- Each word has a **5-minute timer** (default). If the timer expires before a word is resolved, it behaves the same as exhausting attempts — see word-reveal rule below.
- After a word is resolved (someone guesses it, the timer expires, or all eligible attempts are exhausted), **the word is revealed to all players** before the room moves to the next word — nobody leaves a word not knowing the answer.
- Winner = highest score after 5 words.

**Tie-break ("penalty round")**: if two or more players are tied on score at the end of the 5 words, they enter a **sudden-death penalty round**:
1. Only the tied players participate (everyone else becomes a spectator for the tie-break).
2. Each penalty word has a tighter cap — **3 attempts**, 2-minute timer.
3. The **first tied player to guess it correctly wins outright**; if the word goes unsolved by all tied players (attempts/timer exhausted), it's revealed and a **new penalty word** is dealt to the same tied group.
4. Repeat until exactly one player wins a penalty word — that player wins the game. (Mirrors a football penalty shootout: sudden death, not best-of-N.)

**Deliverables**: `RoundMode` implementation of `GameMode`; per-word resolution use-case; per-word timer; word-reveal-on-resolution; `PenaltyTieBreak` use-case; scoreboard UI.

**Concurrency-critical**: "first correct guess scores the point" (and "first to win a penalty word") is a race across up to 50 concurrent players — see **ACID** section below for how this is made safe.

**Tests introduced here**: unit tests for round transitions/scoring/timer-expiry/word-reveal, integration test for the concurrent-guess race condition and the penalty tie-break flow.

---

## Phase 3 — Fast Mode (Time Attack)

**Status: done.** `FastGame` (`backend/src/domain/entities/fast-game.ts`) and `FastMode` (`backend/src/application/game-modes/fast-mode.ts`) implement the rules below; `WordRound` (Phase 2) is reused unmodified (`maxAttempts: Infinity`) for per-player infinite-attempt rounds — no changes to Phase 2 domain code. 15 backend tests pass — `fast-game.spec.ts` covers independent per-player word progression, the must-solve-all-5-to-win rule, the timeout-disqualifies-but-doesn't-block-you rule, and the no-winner case; `fast-mode.spec.ts` adds per-player timer-expiry (via `vi.useFakeTimers`) and confirms a resolved player's timeout never fires after they solve early. Frontend (`frontend/src/hooks/useFastGame.ts`, `frontend/src/components/{RaceStatus,RaceLeaderboard,FastRevealBanner}.tsx`) adds a per-player word-index/timer indicator, a race leaderboard (progress through the 5 words, not score), a reveal banner, and a race-finished screen; both packages typecheck and build clean.

Because Round Mode and Fast Mode now run side by side rather than one replacing the other (unlike the Phase 1→Phase 2 handoff), `backend/src/index.ts` starts both `RoundMode` and `FastMode` as separate `Game` instances on separate Socket.io namespaces (`/round`, `/fast`) rather than picking one as "the" live mode — a deliberate stand-in for Phase 5's real lobby/mode-selection UI. The frontend gained a minimal mode-picker screen (`frontend/src/App.tsx`) so both are reachable end-to-end; this picker is throwaway scaffolding, same spirit as Phase 1's scaffolding, and is expected to be replaced by the real lobby in Phase 5.

Two rule clarifications resolved during implementation (not spelled out in the original bullet list):
- **Per-player independent progress, not a room-wide shared word**: unlike Round Mode, each player races through the 5-word sequence at their own pace — their own word index, own attempts, own per-word timer. This is what makes "first to finish" well-defined per `product.md`'s "race to finish detection" framing.
- **A forced timeout-reveal disqualifies that player from winning** (but doesn't block them from continuing to the next word, exactly as the original bullet intended by "isn't permanently locked out of finishing all 5"). If every player finishes the 5 words and nobody solved all of them without a timeout, the game ends with no winner (`winnerId: null`).

- 5 words per game.
- **Infinite attempts** per word (no 6-attempt cap).
- The **first player to correctly guess all words wins the game** — it's a race, not a per-word point system.
- Same **5-minute-per-word timer** as Round Mode still applies (the timer is a `GameMode`-agnostic rule — see Phase 5 configurability). If a word's timer expires before *any* remaining player solves it, the word is **revealed to everyone still on it** and all players advance to the next word together — a stuck word can't stall the race forever, and a slow player isn't permanently locked out of finishing all 5.

**Deliverables**: `FastMode` implementation of `GameMode` (same interface as `RoundMode` — no changes to room/use-case orchestration code, confirming the Phase 1 OCP bet paid off); shared per-word timer logic reused from Phase 2, not reimplemented.

---

## Phase 4 — Private Rooms & Identity

**Status: done.** All 21 tasks below landed in a single commit (`ab525e1 feat: create rooms feature`), which also pulled forward several Phase 5 building blocks ahead of schedule (`room-settings.ts`, `host-migration-tracker.ts`, and the `unauthorized-host-action`/`room-already-started` error types — see Phase 5 notes). Backend: 60 tests pass across 11 files (`room-code.spec.ts`, `create-room.spec.ts`, `join-room.spec.ts`, `game-mode-registry.spec.ts`, plus the pre-existing Phase 2/3 suites, now exercising the multi-room path). Both packages typecheck clean.

Two gaps found during a post-implementation audit and fixed directly (not deferred — they'd have broken the app at runtime/build time):
- **`@fastify/cors` was imported in `backend/src/index.ts` but never added to `backend/package.json`** — the backend would crash on startup outside a node_modules state left over from local dev. Added as a dependency.
- **Frontend `RoomRecord` (`frontend/src/lib/types.ts`) was missing `isPublic`/`settings`/`status`**, which the backend's `RoomRecord` (`backend/src/domain/repositories/room-repository.ts`) already sends on every room payload. Brought the frontend type in sync (added `RoomSettings`/`RoomStatus` too) ahead of Phase 5, since the fields already exist on the wire.

- **Private rooms**: created and shared via link/code with friends.
- **No account required**: players join instantly with just a chosen **nickname**.
- Nickname selection per session (no auth).

**Deliverables**: `RoomRepository` (Redis-backed) with room codes, room creation/join use-cases, nickname-as-session-identity (no password, no persistent user record).

P4.1: Add ioredis dependency + redisUrl env config — done (`backend/src/infrastructure/config/env.ts`)

P4.2: room-code.ts value object + spec — done

P4.3: room-repository.ts interface + RoomRecord + MAX_PLAYERS_PER_ROOM — done

P4.4: room-not-found-error.ts + room-full-error.ts — done

P4.5: in-memory-room-repository.ts test fixture — done

P4.6: redis-client.ts + redis-room-repository.ts — done

P4.7: game-mode-registry.ts + spec — done

P4.8: round-mode.ts emits roomId in payloads — done

P4.9: fast-mode.ts emits roomId in payloads — done

P4.10: create-room.ts use-case + spec — done

P4.11: join-room.ts use-case + spec — done

P4.12: extend guess-payload.ts DTOs with code field — done

P4.13: http/routes/rooms.ts (POST /rooms, GET /rooms/:code) — done

P4.14: rewrite register-round-mode-handlers.ts for multi-room — done

P4.15: rewrite register-fast-mode-handlers.ts for multi-room — done

P4.16: rewire backend/src/index.ts — done (missing `@fastify/cors` dependency fixed post-audit, see above)

P4.17: frontend lib/api.ts (createRoom, getRoom) — done

P4.18: App.tsx RoomChoiceScreen replacing ModePicker — done

P4.19: useGame/useFastGame accept code param — done

P4.20: lib/types.ts RoomRecord types — done (was missing `isPublic`/`settings`/`status`, fixed post-audit, see above)

P4.21: Backend tests green + manual two-tab check — backend tests green (60/60); manual two-tab check still outstanding

P5.1: room-settings.ts value object + spec — done

P5.2: invalid-room-settings/unauthorized-host/room-already-started errors — done

P5.3: extend RoomRecord with isPublic/settings/status + listPublicLobbies — done

P5.4: in-memory-room-repository listPublicLobbies — done

P5.5: redis-room-repository listPublicLobbies via SET — done

P5.6: host-migration-tracker.ts + spec — done

P5.7: update create-room.ts for isPublic/settings/status lobby — done. `CreateRoomInput` now takes optional `isPublic`/`settings`; the room no longer auto-starts the game on creation — `RoundMode`/`FastMode` only get `joinPlayer`'d (lobby join), the actual round/race begins when `start-game` (P5.11) is invoked.

P5.8: update join-room.ts for lobby vs in-progress branching — done. New (non-reconnecting) joins are rejected with `RoomAlreadyStartedError` once `status !== 'lobby'`; already-joined players (reconnects) are always let back in regardless of status, preserving the multi-tab/reconnect mechanism.

P5.9: leave-room.ts use-case + spec — done (4 tests)

P5.10: update-room-settings.ts use-case + spec — done (5 tests). Host-only, lobby-only; pushes the validated settings into the live `RoundMode`/`FastMode` instance via a new `updateOptions()` method on each.

P5.11: start-game.ts use-case + spec — done (5 tests). Host-only, lobby-only; calls `gameMode.start()` and flips `status` to `in-progress`. Required a `RoundMode`/`FastMode` fix: since players now join during the lobby (before `start()`), `FastMode.start()` was updated to register every already-joined player into the fresh `FastGame` (it previously assumed `start()` ran before anyone joined).

P5.12: list-public-rooms.ts use-case + spec — done (thin pass-through to `RoomRepository.listPublicLobbies()`)

P5.13: migrate-host.ts use-case + spec — done (3 tests). Picks the next player in join order, excluding the outgoing host.

P5.14: rooms.ts routes - public list/settings/start endpoints — done. Added `GET /rooms`, `PATCH /rooms/:code/settings`, `POST /rooms/:code/start`, with domain-error → HTTP-status mapping (404/403/409/400).

P5.15: socket handlers - lobby:state/game:start/host:migrated wiring — done, in both `register-round-mode-handlers.ts` and `register-fast-mode-handlers.ts`. New socket events: `room:leave`, `room:settings:update`, `room:start` (client-initiated, mirroring the HTTP routes but broadcasting live to the room); emits `lobby:state` while `status === 'lobby'` (instead of `room:state`) and `game:start` once the host starts the game. Host-disconnect grace period is wired via `HostMigrationTracker`: a `disconnect` handler checks whether the disconnecting socket was the current host and, if the grace period lapses without a reconnect, calls `migrate-host` and broadcasts `host:migrated`.

P5.16: rewire index.ts with HostMigrationTracker + new use-cases — done. A single shared `HostMigrationTracker` instance is created in `index.ts` and passed to both namespace handler registrations (room codes are unique across modes, so one tracker suffices).

P5.17: frontend api.ts - listPublicRooms/updateRoomSettings/startGame — done

P5.18: Lobby.tsx component — done, backed by a new `frontend/src/hooks/useLobby.ts` (not in the original task list, but required: it owns the lobby's socket connection — join, `lobby:state`/`game:start`/`host:migrated` listeners, and the `room:settings:update`/`room:start`/`room:leave` emitters — mirroring how `useGame`/`useFastGame` own the in-game socket).

P5.19: PublicRoomBrowser.tsx component — done. Rendered inside `RoomChoiceScreen`; fetches `GET /rooms` on mount with a manual refresh button (no live socket updates for the browse list itself — out of scope, matches the "matchmaking" not "live spectating" framing).

P5.20: App.tsx - insert Lobby step + host-migration toast — done. `App` now branches on `room.status === 'lobby'` to render `<Lobby>` before `RoundGameRoom`/`FastGameRoom`; the host-migration notice is rendered inside `Lobby` itself (owned by the `useLobby` hook's state) rather than as a separate App-level toast component — same step, simpler ownership. `RoomChoiceScreen` also gained an "isPublic" checkbox so created rooms can actually appear in the new public browser.

P5.22: Backend tests green + manual lobby/settings/host-migration check — done. Backend: 78/78 tests pass. Manual check: ran the real stack (backend + a local Redis container + the Vite dev server) and drove it with two headless-Chromium tabs (Playwright, since neither `chromium-cli` nor system Chromium deps were available in this sandbox — ran via the official `mcr.microsoft.com/playwright` Docker image instead). Verified end-to-end: host creates a public Round room → lands in a lobby with host controls; second player finds it via the public room browser and joins, sees a host crown on the first player and a disabled, greyed-out settings form; host changes word count from 5→3 and the second player's lobby view updates live via `lobby:state` with no reload; host clicks "Iniciar partida" and **both** tabs transition automatically via `game:start` into the real word-grid game, already reflecting the updated word count ("Palavra 1 de 3"); submitted a guess and got correct green/yellow/gray feedback. Zero browser console errors in either tab.

---

## Phase 5 — Public Rooms, Lobby & Live Board

**Status: done (P5.1–P5.22).** Backend test suite is at 78/78 passing (18 new tests across `leave-room`, `update-room-settings`, `start-game`, `list-public-rooms`, `migrate-host` specs), both packages typecheck and build clean, and the full lobby flow (create → public browse/join → live settings sync → host start → in-game transition) was exercised end-to-end in a real two-tab browser session (see P5.22 below).

The lobby model required one real architectural change beyond the task list's wording: previously `createRoom` called `gameMode.start()` immediately, so the round/race timer began the instant the host created the room — before any other player could join. `RoundMode`/`FastMode` now support joining during a true pre-game lobby (`joinPlayer` lazily creates the room shell; `start()` reuses it instead of recreating it), and the actual game only begins when the host explicitly calls `start-game` (P5.11). This is what makes "lobby shows players before the game starts; host controls start" (the Phase 5 goal below) literally true rather than cosmetic.

Remaining frontend work (P5.17–P5.21) and the closing manual check (P5.22) are not started — `frontend/src/lib/api.ts` has no `listPublicRooms`/`updateRoomSettings`/`startGame` calls yet, and there's no `Lobby.tsx`/`PublicRoomBrowser.tsx` UI, so a host currently has no way to trigger `room:start`/`room:settings:update` from the browser even though the backend fully supports it via socket events or the new HTTP routes.

- **Public rooms**: open, anyone can join.
- Lobby shows current players before the game starts; host (room creator) controls start/settings.
- Shared real-time board: every player's guesses, attempt count, and letter feedback (colors + positions) visible to all players in the room as they happen.
- **Room settings become configurable** by the host at room-creation/lobby time, with the rules from Phase 2/3 as defaults:
  - **Number of words** (default 5).
  - **Number of guesses/attempts per word** (default 6 for Round Mode; irrelevant/ignored for Fast Mode).
  - **Time per word** (default 5 minutes).
  - These three are a `RoomSettings` value object validated against sane bounds in `domain` (e.g., word count 1–15, attempts 1–10, timer 30s–15min) so a host can't configure a degenerate/unplayable room.

**Deliverables**: public room listing/matchmaking, lobby UI with host controls and settings form, multi-board live view (all players' grids, not just your own).

---

## Out of Scope (for now)

- Native mobile apps (web-first, responsive web app).
- Persistent accounts, friend lists, monetization.
- Languages other than Brazilian Portuguese.
- Spectator mode, custom/user-submitted word lists, voice chat.

---

## Cross-Cutting Principle: SOLID (code structure)

Full detail in `CODING_STANDARDS.md`; how it applies specifically to this project's evolution across phases:

- **S — Single Responsibility**: `GameMode` implementations only decide round/scoring rules; they never touch persistence or socket transport directly. `RoomRepository` only persists room state; it never validates guesses.
- **O — Open/Closed**: new modes (Phase 2, 3) and new room types (Phase 4, 5) are added by writing new classes (`RoundMode`, `FastMode`, public/private room policy) behind existing interfaces — Phase 1's use-cases and socket handlers are not edited to support them.
- **L — Liskov Substitution**: any `GameMode` (single-word, round, fast) must be usable wherever the use-case layer expects a `GameMode` — same lifecycle contract (`start`, `submitGuess`, `isResolved`, `getWinner`), no mode throwing on calls another mode handles.
- **I — Interface Segregation**: `RoomRepository` and `WordRepository` stay narrow (one cohesive set of methods each) rather than one fat `GameRepository` — Phase 4's room logic shouldn't need to know about word dictionaries.
- **D — Dependency Inversion**: use-cases depend on `RoomRepository`/`WordRepository` interfaces (`domain`), never on the concrete Redis client — keeps Phase 1's throwaway infra swappable later without touching `domain`/`application`.

## Cross-Cutting Principle: ACID (data integrity & concurrency)

Redis is not a full ACID RDBMS by default, so each property is deliberately engineered, not assumed:

- **Atomicity**: "first correct guess scores the point" (Phase 2) and "first player to finish wins" (Phase 3) are resolved with a **Redis Lua script or `MULTI`/`EXEC` + optimistic `WATCH`** compare-and-set on a `wordResolved`/`gameWinner` flag. A guess only counts if the atomic set-if-not-already-resolved succeeds — eliminates the race where two players' guesses arrive "simultaneously."
- **Consistency**: domain invariants (max 6 attempts in Round Mode, exactly 5 words per game, valid room capacity ≤ 50) are enforced in `domain` entities before any state mutation is persisted — invalid transitions are rejected, never written then cleaned up.
- **Isolation**: per-room state keys are scoped so concurrent rooms never interfere; within a room, the atomic compare-and-set above is what gives isolation between concurrently-arriving guesses for the same word.
- **Durability**: live game state in Redis is intentionally ephemeral (rooms are short-lived — durability there is a non-goal, TTL cleanup is correct behavior). If/when persistent data is introduced (final scores, leaderboards beyond a single room's lifetime), that data moves to a durable, transactional store (Postgres) — durability requirements decide *where* data lives, not how Redis is configured.

## Cross-Cutting Concern: Anti-Abuse & Resilience

Three gaps identified in review, resolved as follows (technical detail in `tech.md`):

**Multi-tab exploit (extra attempts via multiple sessions)**: attempts/score are tracked server-side keyed by a **persistent player identity** (`playerId`), not by socket connection. The server issues a long-lived, non-session cookie containing `playerId` the first time a browser visits — cookies are shared across all tabs of the same browser, so opening a second tab reuses the same `playerId` automatically and hits the same attempt pool. If a second socket connects with a `playerId` already active in a room, the server treats it as a **reconnect**: it takes over the existing player slot (and its remaining attempts/score) rather than creating a new one — this is the same mechanism that powers reconnect-state-restore (Nielsen heuristic #9), not a separate system. This is a deterrent, not a cryptographic guarantee — a player using a different browser/incognito session gets a new `playerId`. Given the explicit no-account constraint, a soft secondary check (cap on distinct `playerId`s joining the same room from one IP in a short window, logged and rate-limited) is the documented limit of what's enforceable without accounts.

**Host disconnect (Phase 5)**: each room keeps a **succession list** ordered by join time among currently connected players. On host disconnect, the room enters a short grace period (30s); if the host reconnects (same `playerId`, per the mechanism above) within the window, they resume as host with no visible disruption. If the grace period lapses, host role **permanently transfers** to the longest-connected remaining player, broadcast to the room. An empty room (no players left) is torn down immediately via existing Redis TTL cleanup.

**Private room code brute-forcing**: room codes are generated server-side with a CSPRNG, **8 characters** from a 32-symbol alphabet that excludes visually ambiguous characters (`0`/`O`, `1`/`I`/`L`) — keyspace ≈ 32⁸ (≈10¹²), making blind brute force impractical. The join-by-code path additionally gets its **own rate limit** (separate from general API rate limiting) since it's specifically an enumeration target — implemented: `GET /rooms/:code` is capped at 20/min per the global `@fastify/rate-limit` instance's route-level override (`backend/src/presentation/http/routes/rooms.ts`), `POST /rooms` at 10/min — and a code is invalidated the moment its room is torn down so old codes can't be replayed against a future room.

**Player/host impersonation via a leaked `playerId` (found in a 2026-06-28 security audit, fixed same day)**: `playerId` identifies a roster seat and is broadcast to every room member (and, before the fix, to anyone browsing the public room list via `GET /rooms`) — it was never a secret. Host-gated actions (`start-game`, `update-room-settings`) and identity-sensitive ones (`leave-room`, `guess:submit`) were authorized by bare string-equality against this same public value, so anyone who read a room's roster (or just polled the public listing) could impersonate the host or any other player. Fixed with a `PlayerSessionStore` (`backend/src/infrastructure/realtime/player-session-store.ts`): a random per-player secret is issued only to that player's own socket on `room:join` (event `room:session`, never broadcast) and must accompany every privileged action afterward; `GET /rooms` no longer includes `players[].playerId` at all. Residual limitation, accepted for now: the `room:join` step itself still trusts a bare `playerId`, so a leaked `playerId` can still be used to *reconnect* as that player (issuing a fresh secret and invalidating the real owner's) — closing that fully would mean binding the join step itself to a persisted secret, which conflicts with the simple "reconnect via known playerId" mechanism the multi-tab exploit mitigation above depends on. Also fixed in the same pass: the REST API's CORS was `origin: true` (reflect any origin) while Socket.IO already correctly used `env.corsOrigin` — now consistent; added `@fastify/helmet` for baseline security headers.

## Cross-Cutting Principle: Nielsen's 10 Usability Heuristics (frontend)

Applied concretely to termo.io's UI, phase by phase:

1. **Visibility of system status**: live connection indicator, attempts-remaining counter, whose-turn/word-index indicator (Round/Fast Mode), real-time update of other players' boards the instant they guess.
2. **Match between system and the real world**: Brazilian Portuguese throughout the UI (no untranslated strings); standard Termo/Wordle color semantics (green/yellow/gray) that BR players already recognize.
3. **User control and freedom**: explicit "leave room" action; host can cancel/restart a game (Phase 5); no irreversible action without a clear trigger (e.g., starting the game is a deliberate host action, not automatic).
4. **Consistency and standards**: one color meaning across every screen and mode; identical grid/keyboard layout between Round Mode and Fast Mode so switching modes doesn't relearn the UI.
5. **Error prevention**: disable guess submission for words of the wrong length or not in the dictionary *before* sending to the server; disable the submit button while a request is in flight to prevent duplicate submits.
6. **Recognition rather than recall**: on-screen keyboard reflects used-letter states (green/yellow/gray) like the real Termo/Wordle, so players don't have to remember which letters they've tried.
7. **Flexibility and efficiency of use**: physical keyboard input and on-screen keyboard both work; room code can be joined via direct link (skip manual entry) or typed code.
8. **Aesthetic and minimalist design**: the word grid is the visual focus; lobby/scoreboard chrome stays minimal so it doesn't compete with the board, especially in the 50-player shared-board view (Phase 5).
9. **Help users recognize, diagnose, and recover from errors**: clear, specific messages ("palavra não existe na lista" vs. a generic error) for invalid guesses; reconnect flow restores the player's exact in-progress state rather than dropping them to an error screen.
10. **Help and documentation**: a lightweight rules/legend popover (color meanings, attempts allowed, mode rules) accessible from the game screen — no separate help site needed for a game this simple.
