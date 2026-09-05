# End of Game & Restart

## Overview

What happens when a multiplayer game (Championship or Race) ends: a scoreboard modal, and a host-controlled path back into a new match with the same room and roster.

## Business Requirements

1. When a game ends, every player in the room sees a scoreboard modal showing the winner(s) and a per-word result table (rows = words, columns = players, showing who solved each word).
2. Race Mode additionally shows an immediate "winner" announcement to everyone the moment a player finishes the race, before the full end-of-race summary is shown.
3. The scoreboard modal can be dismissed (closed) without ending the underlying game/room state — it's just a view.
4. Starting a new match after one ends is **host-controlled**, not automatic: the host sees a "start new match" action; everyone else sees a waiting message until the host acts.
5. Once the host starts a new match, a countdown (10 seconds) runs for everyone before the new match actually begins — the same countdown mechanism used when starting the very first match from the lobby.
6. The room and its current player roster are preserved across a restart — players don't need to rejoin.

## Technical Requirements

1. `frontend/src/components/PlacarModal.tsx` renders the scoreboard: headline (winner names), a `PlacarWordRow[]` table, and a `footer` slot.
2. Both `ChampionshipGameRoom` and `RaceGameRoom` (`frontend/src/App.tsx`) build `PlacarWordRow[]` locally from `wordHistory`/`revealHistory` and pass a `RestartFooter` component as the `footer` — host sees a button, non-hosts see a waiting message.
3. `RestartFooter`'s button emits `room:restart` over the socket; `useGame.ts`/`useRaceGame.ts` expose this as `restartGame()`.
4. Countdown: `backend/src/presentation/sockets/handlers/room-countdown.ts`'s `runWithCountdown` is shared between `room:start` (first match) and `room:restart` (subsequent matches). `COUNTDOWN_SECONDS = 10`. The client listens for `room:countdown:started` and ticks it down locally.
5. Race Mode's immediate winner announcement is driven by the `race:finished` event firing before/alongside the modal build — check `useRaceGame.ts`'s handling order if reproducing exact timing.

## Acceptance Criteria

- [ ] Every player sees the same scoreboard modal content at game end.
- [ ] Closing the modal does not restart or end the room.
- [ ] Only the host can trigger a restart; non-hosts see a waiting state instead of a button.
- [ ] A restart runs the same 10-second countdown as an initial game start.
- [ ] The player roster carries over unchanged into the restarted match.

## Known Issues / Cleanup Notes

- `.kiro/steering/product.md` currently claims "a new match begins automatically 5 seconds after each game ends" — this is **false**. Restart requires an explicit host action, and the countdown is 10 seconds, not 5. This needs correcting before anyone designs the rewrite around the wrong assumption.
- `PlacarModal` wraps its `footer` prop inside a `<p>` element, but `RestartFooter` itself returns `<button>`/`<p>` — producing a nested `<p>` (invalid HTML). Cosmetic/lint-only, not functionally broken, but worth fixing rather than reproducing in the rewrite.
