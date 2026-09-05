# Race Mode

## Overview

A multiplayer mode with unlimited attempts per word, where the winner is the first player to correctly solve every word — but only if they never let a word time out along the way.

## Business Requirements

1. A game consists of a configurable number of words (default 5).
2. Players have **unlimited attempts** per word — no 6-attempt cap like Championship.
3. Each word still has a **time limit**; a player who fails to solve a word before its time limit passes cannot win the game overall, even if they go on to finish every word afterward.
4. The **first player to correctly solve every word, having never timed out on any of them,** wins the race.
5. If no player satisfies that (everyone times out on at least one word at some point), the game ends with no winner once everyone has finished.
6. Mid-race UI is intentionally minimal: no attempt counters and no "word resolved" banners are shown while the race is live. All players' results are only shown together once the race itself has ended, in a single end-of-race summary.
7. Live running tallies of correct/wrong words per player (small stat badges) **do** update during the race, even though the round-status banner UI is hidden — these are two independently governed pieces of UI.

## Technical Requirements

1. Core logic: `backend/src/application/game-modes/race-mode.ts`, `backend/src/domain/entities/race-game.ts`.
2. Each player has an independent `WordRound` per word with `maxAttempts = Infinity`, but `schedulePlayerTimeout` still enforces the room's per-word `timeLimitMs`.
3. `resolvePlayerWord` sets `playerWon = progress.allSolved`; a player who times out on any word has `allSolved` permanently forced `false` — they can never become the race winner from that point on, regardless of later solves.
4. The game ends when a fully-solved (`allSolved`) player finishes all words (they win), or, failing that, once every player has finished (no winner).
5. Frontend: `frontend/src/hooks/useRaceGame.ts` owns the `/race` socket connection; listens to `room:state`, `player:word-started`, `player:word-resolved`, `race:finished`, `guess:result` (filtered by the player's own `wordIndexRef` to avoid cross-word races), `guess:error`.
6. `components/RaceStatus.tsx` is shown only while the local player hasn't finished — displays word index and countdown, no attempts counter (per the minimal-UI requirement).
7. `sessionStats` (derived from `revealHistory` in `useRaceGame.ts`) drives the live guess-stat badges: one entry per player per word as each individually finishes it (`player:word-resolved`); `reason === 'solved'` → +1 correct, otherwise +1 wrong. Updates live, unlike the round-status banner.
8. End-of-race `PlacarModal` is built from `revealHistory` grouped per word index — see [end-of-game-and-restart.md](end-of-game-and-restart.md).

## Acceptance Criteria

- [ ] A player can submit more than 6 guesses on a single word without being blocked.
- [ ] A player who lets one word time out cannot win the race even if they finish every remaining word first.
- [ ] While the race is live, no player sees another player's per-word attempt count or a "word resolved" banner.
- [ ] Guess-stat badges (correct/wrong counts) update in real time during the race despite the above.
- [ ] The end-of-race summary reveals all players' per-word results together, only after the race ends.

## Known Issues / Cleanup Notes

None found — Race Mode's implementation matches `.kiro/steering/tech.md`'s description closely, aside from the per-word timeout nuance (point 3 above) which neither steering doc mentions explicitly.
