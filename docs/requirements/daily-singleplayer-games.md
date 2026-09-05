# Daily Singleplayer Games (Termo, Dueto, Quarteto)

## Overview

Three solo, no-account, no-room daily puzzles sharing the multiplayer word-matching engine: the same secret word(s) for every player worldwide on a given calendar day. **This is fully shipped**, not a future feature — both `.kiro/steering` docs currently (incorrectly) describe it as "planned."

## Business Requirements

1. Three variants, differing only in board count and shared attempt budget:

   | Game | Simultaneous words | Shared attempts |
   |---|---|---|
   | Termo | 1 | 6 |
   | Dueto | 2 | 7 |
   | Quarteto | 4 | 9 |

2. No room, lobby, or nickname is required to play a daily game — it's reachable directly from the global navbar.
3. Everyone on Earth gets the **same** secret word(s) for a given calendar day (Brazil time), so results are comparable ("I solved today's Quarteto in 6 guesses").
4. In Dueto/Quarteto, one typed guess is checked against **every still-unsolved board at once** and counts only **once** against the single shared attempt budget, not once per board.
5. The puzzle ends when every board is solved, or the shared attempt budget is exhausted — whichever comes first.
6. After finishing (win or loss), a stats modal shows games played, win rate, current/best streak, an attempt-distribution chart, and a share button that copies an emoji-grid summary of the result.
7. The modal also shows a live countdown to the next day's puzzle.
8. Progress and history are tracked entirely on the player's device — there is no account and no server-side record of a player's results.
9. Refreshing mid-puzzle does not lose progress — guesses made so far are restored.

## Technical Requirements

1. Mode configuration: `backend/src/application/game-modes/daily-modes/daily-mode-config.ts` — `termo: {wordCount:1, maxAttempts:6}`, `dueto: {2,7}`, `quarteto: {4,9}`.
2. Deterministic word selection: `backend/src/infrastructure/persistence/words/daily-word-resolver.ts` — FNV-1a hash of `` `${date}:${mode}` `` as a base seed, then repeated hashing (`fnv1aHash(`${baseSeed}:${step}`) % wordlist.size`) walked until `wordCount` **distinct** indices are found. Requires no persistence — any server, at any time, recomputes the same word(s) for a given date+mode.
3. Date resolution is fixed to `America/Sao_Paulo` via `Intl.DateTimeFormat` (`backend/src/domain/value-objects/puzzle-date.ts`) and mirrored client-side in `frontend/src/lib/puzzle-date.ts` and `hooks/useNextPuzzleCountdown.ts`, so the puzzle rolls over at the same instant for everyone regardless of local timezone.
4. **The backend holds no server-side per-player puzzle state at all.** `backend/src/domain/entities/daily-puzzle.ts`'s `DailyPuzzle.replay()` recomputes every board's feedback from scratch on every request, given the **entire ordered guess history** resent by the client each time. A board stops accepting replayed guesses once solved but every guess still counts once against the shared attempt budget. `finished = won || guesses.length >= maxAttempts`.
5. Routes (`backend/src/presentation/http/routes/daily.ts`): `GET /daily/:mode/config` returns `{wordCount, maxAttempts}` only. `POST /daily/:mode/guess` (rate-limited 60/min) takes the full `guesses[]` array and returns fresh feedback via `application/use-cases/daily/submit-daily-guess.ts` → `DailyPuzzle.replay`. There is **no** `GET /daily/:mode` puzzle-fetch endpoint — there's no puzzle state to fetch beyond the config.
6. Frontend: `frontend/src/hooks/useDailyGame.ts` owns config/guesses/result/stats state and replays stored guesses against the server on mount (refresh-resilience). `lib/daily-progress-storage.ts` persists guesses keyed by `mode:date` in `localStorage`. `lib/daily-stats-storage.ts` tracks games/wins/streaks/attempt distribution, `localStorage`-only. `recordDailyResult` is guarded by a `lastRecordedDate` so it only fires once per day per mode.
7. UI: `components/DailyGameRoom.tsx` renders `wordCount` `WordGrid`s side by side fed by one shared `Keyboard`/`useGuessInput` buffer and one shared attempt counter; `components/DailyStatsModal.tsx` shows the post-game stats/share/countdown; `lib/daily-share-text.ts` builds the shareable emoji-grid text.
8. Reached via the global navbar (`DailyModeBar.tsx`), not a dedicated entry screen — see [navigation-and-navbar.md](navigation-and-navbar.md).

## Acceptance Criteria

- [ ] Two different players opening Termo on the same calendar day (regardless of their own local timezone) get the identical secret word.
- [ ] In Quarteto, submitting one guess updates feedback on all 4 boards and increments the attempt counter by exactly 1, not 4.
- [ ] Refreshing the page mid-puzzle restores prior guesses and their feedback exactly as before.
- [ ] Completing a puzzle updates streak/stats and they persist across a page reload (same device/browser).
- [ ] The share button produces text summarizing the result without revealing the secret word(s) to someone who hasn't played yet.
- [ ] No network request exposes the secret word(s) before a board is solved or the puzzle ends.

## Known Issues / Cleanup Notes

- **Both `.kiro/steering/product.md` and `tech.md` currently describe this entire feature as "planned."** It is fully shipped (commits `95fb445` "add termo, dueto and quarteto", `c2266bc` "add daily stats"). This is the single biggest doc/reality gap found during research — anyone using the steering docs alone would not know this exists.
- `tech.md`'s planned design assumed a `GET /daily/:mode` puzzle-fetch route alongside `POST /daily/:mode/guess` — only the guess route (plus a separate `/config` route) was actually built, since the stateless-replay design makes a separate fetch endpoint unnecessary.
- `lib/daily-share-text.ts`'s `buildDailyShareText` was simplified in commit `12ed6fd` to drop the header line (game name/date/score) from the copied share text — now emits only the emoji grid rows. This looks like an unintentional regression from a more complete share format; worth deciding whether to restore it in the rewrite.
- A separate, older single-word socket-based mode (`backend/src/application/game-modes/single-word-mode.ts` + `presentation/sockets/handlers/register-game-handlers.ts`) also exists in the codebase but is **dead code** — never wired up in `backend/src/index.ts`. Don't confuse it with the real (HTTP, stateless) daily-games implementation above; it should likely be deleted rather than carried into the rewrite.
