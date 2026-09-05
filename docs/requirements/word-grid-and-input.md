# Word Grid & Input

## Overview

Shared UI primitives used by every game mode (multiplayer and daily): the tile grid that displays guesses, the cursor-based letter input, and the on-screen/physical keyboard.

## Business Requirements

1. A player can position the cursor anywhere in the active guess row — via arrow keys or by clicking/tapping any cell — and type or overwrite a letter there. Input is not limited to strictly left-to-right typing.
2. After typing a letter, the cursor advances to the next **empty** cell in the row (wrapping around), not simply the next position — so overwriting a filled cell doesn't strand the cursor on an already-filled cell.
3. A submitted guess that isn't a real dictionary word is rejected: the row **shakes** but the typed letters are preserved so the player can just fix and resubmit, rather than losing their input.
4. Once a guess is accepted, each tile flips to reveal its color feedback (green/yellow/gray), one column at a time in a quick staggered animation.
5. The on-screen keyboard is always anchored to the bottom of the screen, on every game mode and screen size. Keys are colored by the best-known status for that letter across all of the player's attempts so far.
6. Physical keyboard input works in parallel with the on-screen keyboard: letters, Enter (submit), Backspace (delete), and arrow keys (move cursor) all work without touching the mouse.
7. The player's own board grows one row at a time as they play. Every other player's board reserves all its attempt rows up front so the layout never shifts as guesses come in.
8. Small badges above each grid show a running correct/wrong word tally, for both the local player and others, wherever both counts are supplied.
9. **On narrow screens (phones)**, the game screen reflows to a single column: the player's own board comes first, other players' boards become a horizontally-scrollable strip below/above it instead of a fixed side panel, and the empty balance-spacer column used on wider screens disappears entirely. Daily-game boards (Dueto/Quarteto) shrink their tiles so 2 boards fit side by side on a phone width instead of overflowing. Modals (scoreboard, daily stats) resize to fit the viewport rather than keeping a fixed desktop size.

## Technical Requirements

1. `frontend/src/hooks/useGuessInput.ts` owns the active row's letter buffer and cursor position, independent of the grid component. Its reset effect keys on `[wordLength, resetKey]` — callers must pass a `resetKey` that changes whenever the target word advances (Championship: `round.roundSequence`; Race: the player's own `wordIndex`; daily modes: puzzle date/mode), otherwise leftover state persists into the new word.
2. Cursor-after-type behavior: `nextCursorAfterType(letters, wordLength, from)` scans forward from the just-typed position for the next empty cell, wrapping around the row; falls back to `from + 1` (wrapped) once every cell is filled. This supersedes the older behavior of always advancing by exactly one position.
3. `frontend/src/components/WordGrid.tsx` renders a stack of rows: resolved attempts (revealed via a per-column flip staggered ~80ms apart, ~450ms total), then (own grid only, while eligible) one live active-input row, then empty placeholder rows padded to `totalRows`.
4. Rejected-guess handling: `handleEnter` in `App.tsx` does **not** clear the row eagerly on submit (it's fire-and-forget) — clearing only happens from an effect watching the player's own `attempts.length`, so it fires exactly when the server actually accepts the guess. On `guess:error`, a `guessRejectedToken` counter increments (independent of message content, so repeated identical rejections still register) and is passed to `WordGrid` as `activeRowShakeToken`, which toggles a `.word-row-shake` class for 500ms (`@keyframes shake` in `frontend/src/index.css`) without touching the typed letters.
5. Own grid vs. others': the own ("my-word") grid has no fixed `totalRows` — it grows to `attempts.length + 1`. Other players' grids (`PlayerBoard.tsx`) always pass a fixed `totalRows` (Championship: current round's `maxAttempts`; Race: hardcoded 6).
6. `frontend/src/components/Keyboard.tsx`: on-screen QWERTY, 3 rows, no accented keys (matching, accent-insensitive input server-side). Wide Backspace on row 2, wide "Enviar" submit key on row 3. Key color priority: `correct` > `present` > `absent`. Physical input is wired via a `window` `keydown` listener, separate from the on-screen `<button>` elements.
7. Guess-stat badges (`.guess-stats`) render whenever both `correctWords` and `wrongWords` are supplied; both replay a "pop" animation on change (re-keyed by value).
8. **Responsive layout** (`frontend/src/index.css`, `@media (max-width: 640px)`, lines ~1038-1109): on desktop, `.game-layout` is a 3-column CSS grid (`minmax(0,1fr) auto minmax(0,1fr)`) — `.other-players-panel` | `.game-center` (own board) | `.game-aside` (an empty spacer div, purely for centering the own board, no content). Below 640px this collapses to a single column (`grid-template-columns: 1fr`): `.game-center` reorders to `order: 1` (shown first), `.other-players-panel` to `order: 2` and switches from a vertical list to a horizontally-scrolling strip (`flex-wrap: nowrap; overflow-x: auto`, each entry `flex: 0 0 auto`), and `.game-aside` is hidden entirely (`display: none`). Daily-game boards (`.daily-boards[data-count="2"|"4"]`) switch to a 2-column CSS grid with tiles clamped to `clamp(24px, 7vw, 34px)` (down from the desktop default) so Dueto/Quarteto's multiple boards fit a phone width. `.modal-card-large` resizes to `94vw`/`85vh`. `.app-main-with-keyboard` gets extra bottom padding (230px vs. 220px on desktop) to clear the on-screen keyboard. Separately, `@media (min-width: 900px)` enlarges the global navbar (`.mode-bar`: 40px → 56px tall, more horizontal padding/gap) — see [navigation-and-navbar.md](navigation-and-navbar.md).

## Acceptance Criteria

- [ ] Clicking any cell in the active row moves the cursor there; typing then inserts/overwrites at that position.
- [ ] Typing a letter into the last empty cell before a filled one moves the cursor to the next empty cell, not just +1.
- [ ] Submitting a non-dictionary word shakes the row but leaves every typed letter in place.
- [ ] Reloading mid-word does not lose the reset-key contract — the active row is empty/correct after a word actually advances.
- [ ] Other players' boards never shift height as their attempts arrive.
- [ ] At a phone-width viewport (≤640px), the own board is the first thing shown, other players appear as a horizontally-scrollable strip, and no empty spacer column takes up screen space.
- [ ] A Quarteto puzzle's 4 boards are all visible without horizontal overflow at a phone-width viewport.

## Known Issues / Cleanup Notes

- As of this doc, `useGuessInput.ts` / `WordGrid.tsx` / `index.css`'s "jump to next empty cell" behavior (points 2 above) is an **uncommitted** working-tree change, not yet in a commit. Confirm it's intentional and finished before treating it as settled spec for the rewrite.
