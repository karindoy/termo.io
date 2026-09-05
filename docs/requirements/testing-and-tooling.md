# Testing & Tooling

## Overview

What actually verifies correctness today: a Playwright e2e suite and backend unit tests. There is no frontend test coverage and no lint/CI gate, despite README's contributing guidelines implying both are enforced.

## Business Requirements (what must remain verifiable)

1. Both game modes must be provably correct at the room's maximum size (50 players) end-to-end, including the tie-break path.
2. Core domain logic (scoring, matching, session handling) must have fast, isolated tests that don't require a running server.
3. Whatever a contributor is asked to run before opening a PR (per README) should actually be able to fail the build if violated — today nothing enforces it automatically.

## Technical Requirements

1. **E2E**: `e2e/tests/max-players.spec.ts` (Playwright, `test.describe.serial` — both tests share one backend process and one `E2E_FIXED_WORDS` cursor, so order matters):
   - "corrida — 50 players, one winner" (Race Mode): 50 players join, all but one burn 4 wrong guesses, the winner submits the correct word before the rest submit their 5th wrong guess; asserts the scoreboard modal appears. Screenshots at lobby/game/placar stages.
   - "campeonato — 50 players, tie-break, one winner" (Championship Mode): 2 words, 5 attempts/word; round 1 won by player A, round 2 by player B (1-1 tie) triggers a tie-break restricted to just those two — a spectator's UI is asserted to show the "not in the tie-break" state; player A wins the tie-break and becomes champion.
   - No e2e coverage exists for the daily-puzzle modes (Termo/Dueto/Quarteto) — those are unit-tested only.
   - Runs entirely inside Docker (`e2e/docker-compose.yml`: redis + backend + frontend + a Playwright-bundled runner), via `e2e/run.sh`, which computes `E2E_FIXED_WORDS` from the backend's own `wordlist.txt` and exports overridable `E2E_PLAYER_COUNT` (default 50) / `E2E_TEST_TIMEOUT_MS` (default 900000).
   - `e2e/playwright.config.ts`: 15-minute test timeout, `workers: 1`, `retries: 0`, Chromium with `--unsafely-treat-insecure-origin-as-secure` (needed since the app calls `crypto.randomUUID()` and the Docker-network origin isn't a secure context).
2. **Backend unit/integration tests**: 19 Vitest spec files under `backend/src/**/*.spec.ts`, covering domain entities (`daily-puzzle`, `game`, `race-game`, `word-round`), value objects (`room-code`, `room-settings`), game-mode strategies (`championship-mode`, `race-mode`), room-lifecycle use-cases (`create-room`, `join-room`, `leave-room`, `list-public-rooms`, `migrate-host`, `start-game`, `update-room-settings`), daily use-case (`submit-daily-guess`), and infrastructure (`daily-word-resolver`, `game-mode-registry`, `host-migration-tracker` — verified with fake timers that the 30s grace period fires/cancels correctly and independently per room —, `player-session-store`).
3. **Frontend: zero test files exist** (`frontend/package.json` has no `test` script at all), despite non-trivial logic living in hooks like `useGuessInput.ts` and components like `WordGrid.tsx`.
4. **No lint/format tooling anywhere in the repo**: no `.eslintrc*`, `eslint.config.*`, or `.prettierrc*` at root, backend, or frontend. Only `tsc` type-checking exists.
5. **No CI configuration exists**: no `.github/workflows/` or any other CI system config. README's "Contributing" section says to "Ensure `npm run typecheck` and `npm run test` pass before opening a PR," but nothing automatically enforces this — it's a documented convention only.
6. Root `package.json` scripts: `dev:backend`, `dev:frontend`, `build`, `typecheck`, `test` (backend only), `test:e2e` (delegates to the `e2e` workspace).

## Acceptance Criteria

- [ ] The e2e suite passes at 50 players for both game modes, including the tie-break path, on a clean checkout.
- [ ] Backend unit tests pass without any external service running (pure domain/application logic, in-memory fakes for repositories).
- [ ] `npm run typecheck` passes across all workspaces.

## Known Issues / Cleanup Notes

- The complete absence of frontend tests, lint/format tooling, and CI enforcement is a real gap for the rewrite to deliberately address — not something to silently reproduce. At minimum, decide whether the rewrite adds: a frontend test runner (Vitest + Testing Library is the natural fit given the backend already uses Vitest), ESLint/Prettier, and a CI workflow gating typecheck/lint/test on PRs.
- Daily-puzzle modes have no e2e coverage despite being a fully shipped, user-facing feature (see [daily-singleplayer-games.md](daily-singleplayer-games.md)) — worth adding at least a smoke-level e2e test for the rewrite.
