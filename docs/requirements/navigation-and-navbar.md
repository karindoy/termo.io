# Navigation & Navbar

## Overview

The top-level screen flow: nickname entry, then a global navbar that lets a player jump between multiplayer rooms and daily games at any time, plus refresh/reconnect restoration.

## Business Requirements

1. A player enters a nickname once (persisted on their device); after that, the app never asks for it again.
2. Once a nickname exists, a **persistent navbar** is present on every screen (room choice, lobby, in-game, daily games) with:
   - A home button that returns to the room-choice screen, leaving any active room/daily game.
   - Tabs to jump directly into Termo, Dueto, or Quarteto — from anywhere, without leaving to a separate entry screen first.
3. From the room-choice screen, a player can create or join a multiplayer room (public/private), same as before.
4. Refreshing the page while actively in-progress in a multiplayer game restores the player straight back into that game (skipping the choice/lobby screens) — but only if the game is still running and the player is still seated in it. Otherwise, the player falls through to the normal choice flow.
5. Switching between daily-game modes via the navbar always starts fresh for that mode — no stale state (guesses, stats modal) leaks over from whichever daily mode was open before.

## Technical Requirements

1. `App.tsx` is a state machine over `nickname`, `room: RoomRecord | null`, `dailyMode: DailyGameMode | null`, `restoring`. Render order: no nickname → `NicknameForm`; else always render `<DailyModeBar>` at the top; then branch: `restoring` → spinner; `dailyMode` set → `<DailyGameRoom key={dailyMode}>`; no `room` → `RoomChoiceScreen`; `room.status === 'lobby'` → `Lobby`; `room.mode === 'championship'` → `ChampionshipGameRoom`; else `RaceGameRoom`.
2. `components/DailyModeBar.tsx` is the global navbar — mounted once in `App.tsx`, present on every screen once a nickname exists. Includes a 🏠 home button that clears both the active room and daily mode simultaneously.
3. Restore-on-refresh: on mount, `App.tsx` calls `GET /rooms/:code` for a room code persisted in `sessionStorage` (`lib/active-room-storage.ts`, per-tab, cleared on tab close or explicit leave/finish) and only restores straight into the game screen when `record.status === 'in-progress'` **and** the stored `playerId` is still present in `record.players`. Otherwise the stored code is cleared and the app falls through to the normal join flow. This deliberately excludes the lobby — a lobby-status disconnect already runs a full `leaveRoom()` synchronously server-side, so there's no seat left to restore by the time a refreshed lobby's `getRoom` call resolves.
4. `<DailyGameRoom key={dailyMode}>` uses `dailyMode` as its React `key` so switching daily modes force-remounts the component (and its `useDailyGame`/stats-modal state) instead of reusing stale state from the previous mode.
5. Identity persistence backing this: `lib/player-identity.ts` (`getOrCreatePlayerId()` mints/reuses a `crypto.randomUUID()` in `localStorage`, plus the nickname), also `localStorage`-persisted.
6. Responsive sizing: the navbar (`.mode-bar`) is 40px tall by default (mobile/default) and enlarges to 56px with more padding/gap at `min-width: 900px` (`frontend/src/index.css`) — see the responsive layout note in [word-grid-and-input.md](word-grid-and-input.md) for the matching sub-640px game-screen collapse.

## Acceptance Criteria

- [ ] A returning player (same device, same tab session) is never re-prompted for a nickname.
- [ ] The navbar's daily-game tabs are reachable from every screen, not just a dedicated entry page.
- [ ] Refreshing mid-game restores the same game screen with the same board state.
- [ ] Refreshing while only in a lobby (game not started) does NOT auto-restore into that lobby's seat.
- [ ] Switching from Termo to Dueto via the navbar clears any stats modal or leftover guess state from Termo.

## Known Issues / Cleanup Notes

- `.kiro/steering/tech.md` documents a planned "Entry screen split" design: separate `#multiplayer-section` and `#singleplayer-section` blocks with daily-game entry cards on `RoomChoiceScreen`. That design **was built** (commits `c2266bc`/`95fb445`) and then **replaced** by the current always-on global navbar approach (commits `12ed6fd`, `9badd15`), which also deleted the `#singleplayer-section` cards entirely. `tech.md` still describes the abandoned design as the target — needs correcting.
- `components/WordRevealBanner.tsx` exists in the codebase but is **dead code** — never imported anywhere. The equivalent message-building logic is duplicated inline inside `ChampionshipGameRoom`'s reveal effect in `App.tsx` instead. Should likely be deleted rather than carried into the rewrite, or the inline logic extracted into it properly.
