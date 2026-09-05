# Championship Mode

## Overview

A multiplayer scoring mode: every player guesses the same words in parallel, and the fewest-attempts solver of each word scores a point. Highest score after all words wins, with a tie-break round if needed.

## Business Requirements

1. A game consists of a configurable number of words (default 5, 1-15 configurable per room).
2. Each word allows a configurable maximum number of attempts per player (default 6, 1-10 configurable).
3. For each word, the **point goes to whoever solves it in the fewest attempts** — not whoever solves it first. The word stays open to every other still-eligible player even after someone solves it.
4. A tie on attempt count is broken by whoever solved it earliest (chronologically).
5. A player who solves a word, or who exhausts their attempts on it, is done with that word — they wait for the round to finish rather than continuing to guess.
6. If **nobody** solves a word within the normal attempt limit before the per-word time limit expires, every player still eligible gets **2 bonus attempts** on the same word before it's abandoned (no winner) and the game advances.
7. After all configured words are played, the player with the highest total score wins.
8. If two or more players are tied for the highest score at the end, a **tie-break round** is played: only the tied players compete on one new word (3 attempts, 2-minute limit); the first of them to solve it becomes champion. Players not in the tie-break cannot guess during it.
9. Time limit per word is configurable per room (30s-10min, stored as milliseconds, not shown to the player).

## Technical Requirements

1. Core logic: `backend/src/application/game-modes/championship-mode.ts`, `backend/src/domain/entities/game.ts`, `backend/src/domain/entities/word-round.ts`.
2. `WordRound.submitGuess` keeps accepting guesses from every other eligible player after the first solve, recording each solver's attempt in `solvedAttempts: Map<playerId, Attempt>`. Once a player solves, further guesses from them are rejected with `AttemptsExceededError` — solving is terminal for that player on that word.
3. `WordRound.bestSolver()` picks the lowest `attempt.attemptNumber`; ties broken by earliest `attempt.createdAt`.
4. `WordRound.hasFinished(playerId)` is true once a player has solved or exhausted attempts; `allPlayersFinished(ids)` requires every id in the eligible set to satisfy that. `ChampionshipMode.checkRoundCompletion()` only resolves the round once this holds for the eligible player set.
5. `ChampionshipMode.eligiblePlayerIds()` returns every connected player normally, but only `game.tieBreakCandidates` while `game.phase === 'tie-break'`.
6. If the per-word timer fires before everyone finishes, `bestSolver()` is checked first — the word is awarded to whoever had solved it, and only falls back to no-winner if nobody had.
7. Tie-break: `Game.advanceRegularRound`/`advanceTieBreak` — after the configured word count, if more than one player shares the max score, `phase` becomes `'tie-break'` with `tieBreakCandidates` set to the leaders; a new random word is played among just them (`tieBreakMaxAttempts: 3`, `tieBreakTimeLimitMs: 2*60*1000`, defaults in `championship-mode.ts`). First solve ends the game.
8. Frontend gating is per-player, not per-round: `ChampionshipGameRoom` (`frontend/src/App.tsx`) derives `hasSolvedCurrentWord` from the player's own attempts (not from a global `solvedBy` flag, which only reflects the whole game concluding) and combines it with the attempts-exhausted check into `hasFinishedWord`, which alone gates `canGuess`. Other players keep guessing normally until the round actually resolves.
9. Guess-stat badges (`playerStats` in `frontend/src/hooks/useGame.ts`) increment once per resolved word for every player simultaneously: the winner gets +1 correct, everyone else +1 wrong.
10. Domain events (`round:started`, `word:resolved`, `tiebreak:started`, `game:finished`) are deliberately deferred with `queueMicrotask` in the socket handlers so ordering versus the just-emitted `guess:result` is preserved.

## Acceptance Criteria

- [ ] A player who solves a word in fewer attempts than another wins the point, even if the other player finished first chronologically.
- [ ] The round does not end the instant the first player solves — other eligible players keep guessing until they finish or run out of attempts.
- [ ] If nobody solves within the base attempt limit, every remaining eligible player gets exactly 2 more attempts before the word is abandoned.
- [ ] A tied final score triggers a tie-break word restricted to only the tied players; a non-tied player cannot submit a guess during it.
- [ ] Tie-break word uses 3 attempts / 2 minutes regardless of the room's regular settings.

## Known Issues / Cleanup Notes

- `.kiro/steering/product.md` does not mention the tie-break rule at all — a player reading only that doc would assume ties are impossible or unresolved.
- `product.md` frames word count/attempts as fixed at "5 words, 6 attempts" — they're actually room-configurable (1-15 / 1-10). Worth deciding whether the rewrite keeps this much configurability or fixes sane defaults.
