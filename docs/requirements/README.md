# termo.io — Requirements Docs

This folder documents **current shipped behavior** of termo.io, one file per feature area, derived from the actual codebase (not from `.kiro/steering/`, which had drifted out of sync with the code before these docs were written). It exists to drive a full rewrite: read a feature's doc to know exactly what business rule and technical mechanism it needs to reproduce (or deliberately change).

## Template

Every doc in this folder follows the same shape:

- **Overview** — 1-2 sentence summary of the feature.
- **Business Requirements** — numbered, plain-language rules describing what a player/host experiences. No implementation detail.
- **Technical Requirements** — numbered, architecture/data-flow description with file paths and key function/class names.
- **Acceptance Criteria** — a testable checklist a rewrite can be verified against.
- **Known Issues / Cleanup Notes** — dead code, bugs, undocumented behavior, or stale-doc gaps found during research. Omitted when a feature has none. These are things the rewrite should *decide about*, not silently reproduce.

## Index

| Doc | Covers |
|---|---|
| [rooms-and-lobby.md](rooms-and-lobby.md) | Room creation/join/leave, capacity, host migration, TTL, settings, room codes |
| [championship-mode.md](championship-mode.md) | Fewest-attempts scoring, bonus attempts, tie-break |
| [race-mode.md](race-mode.md) | Infinite attempts, per-word timeout, first-to-finish-without-timeout win rule |
| [word-grid-and-input.md](word-grid-and-input.md) | Cursor-based guess input, tile grid, keyboard, animations |
| [end-of-game-and-restart.md](end-of-game-and-restart.md) | Scoreboard modal, host-triggered restart, countdown |
| [daily-singleplayer-games.md](daily-singleplayer-games.md) | Termo/Dueto/Quarteto daily puzzles, stats, streaks |
| [navigation-and-navbar.md](navigation-and-navbar.md) | App-level screen routing, global navbar, refresh/reconnect restore |
| [session-identity-and-security.md](session-identity-and-security.md) | Player identity, session secrets, rate limiting |
| [word-dictionary-and-matching.md](word-dictionary-and-matching.md) | Word list, accent-insensitive matching, feedback algorithm |
| [infra-and-deployment.md](infra-and-deployment.md) | Multi-instance backend, nginx sticky routing, Docker, env vars |
| [testing-and-tooling.md](testing-and-tooling.md) | E2E suite, unit test coverage, lint/CI gaps |

## Ground truth

These docs reflect the codebase as of the commits up to `776976c` (`fix: stop publishing redis port to the host`), plus one uncommitted change to `useGuessInput.ts`/`WordGrid.tsx`/`index.css` (cursor jumps to next empty cell on type) noted in [word-grid-and-input.md](word-grid-and-input.md). If the code has moved on since, re-verify against source before trusting a specific claim — these are snapshots, not living specs.
