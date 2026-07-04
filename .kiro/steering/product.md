---
inclusion: always
---

# Product Overview

**termo.io** — a Brazilian Portuguese word-guessing game (Wordle-style, "Termo") with two families of play: real-time **multiplayer rooms** (shipped) and **daily singleplayer puzzles** (planned) — Termo, Dueto, and Quarteto.

## Core Concept

Players guess hidden Brazilian Portuguese words. Every word is always **exactly 5 letters**. Feedback per guess uses standard Wordle-style coloring:

- **Green**: correct letter in the correct position.
- **Yellow**: correct letter, wrong position.
- (Implicit) **Gray/none**: letter not in the word.

**Accent-insensitive matching**: a secret word may contain accented letters (â, ã, á, à, ç, etc.). Typing the unaccented base letter still counts as a correct match — e.g. if the secret word has **â**, guessing plain **a**/**A** in that position is green; if it has **ç**, guessing **c** is green. Players never need an accented keyboard to play correctly; the revealed word still shows the real accented spelling once solved.

## Target Users

- Brazilian Portuguese speakers who enjoy word-guessing games and want a competitive, social version of the genre.
- Friend groups wanting to play together in a private room.
- Casual players who want to jump into a public room instantly, no signup.
- Solo players who want a quick daily challenge (same word(s) as everyone else, once a day) with no room/lobby overhead.

## Game Modes

### Multiplayer (shipped)

All players in a room see each other's nickname, attempts, letter colors, and positions in real time — guesses are not private, the board is shared/visible to everyone.

#### Championship Mode
- 5 words per game.
- Each word allows a **maximum of 6 attempts** per player.
- For each word, the **fewest-attempts solver scores the point** (not first-to-solve — the word stays open until every eligible player finishes; ties broken by earliest solve time).
- After a word is resolved, the room moves to the next word.
- Winner = highest score after 5 words.

#### Race Mode (Time Attack)
- 5 words per game.
- **Infinite attempts** per word (no 6-attempt cap).
- The **first player to correctly guess all words wins the game** — it's a race, not a per-word point system.
- **Minimal in-game UI by design**: hides the attempts counter and any mid-race banner while the race is live. All resolved words (own and other players') are only shown together in a single end-of-race summary, once the race itself has finished.

### Singleplayer Daily Games (planned)

No rooms, no lobby, no other players — a solo player against one or more secret words that are the **same for every player worldwide on a given calendar day**. Three variants, differing only in how many words are solved at once and the shared attempt budget:

| Game | Simultaneous words | Shared attempts | Notes |
|---|---|---|---|
| **Termo** | 1 | 6 | Classic single-board Wordle-style daily. |
| **Dueto** | 2 | 7 | Every guess is checked against both secret words at once; each board reveals its own feedback for that guess. |
| **Quarteto** | 4 | 9 | Every guess is checked against all four secret words at once; each board reveals its own feedback for that guess. |

- **One shared attempt pool per puzzle**: unlike Championship's per-word attempt counts, a single guess in Dueto/Quarteto counts once against the shared attempt budget but is scored independently on every still-unsolved board. The puzzle ends when all boards are solved or the attempt budget is exhausted, whichever comes first.
- **Deterministic daily word(s)**: the secret word(s) for a given day are derived from the calendar date via a seeded algorithm indexing into the same BR-PT wordlist used by multiplayer (see `tech.md`), not stored per-request — anyone (any server instance, any day) recomputes the identical word(s) for that date with no shared database record required. Words within the same puzzle (Dueto's 2, Quarteto's 4) are guaranteed distinct from each other.
- **Everyone gets the same puzzle**: no per-player randomization — the point is a shared daily challenge, comparable across players (e.g. "I solved today's Quarteto in 6 guesses").
- **Still server-authoritative**: even without a room/socket session, the secret word(s) and guess feedback are resolved and validated server-side only, same principle as multiplayer — the client never receives the answer(s) before they're solved or the puzzle ends.
- **Independent of multiplayer infra**: no `Room`/`Player` socket session is needed to play; a lightweight per-day, per-mode puzzle can be served over plain HTTP request/response instead of Socket.io, since there's no other player's state to broadcast.

## Rooms (multiplayer only)

- **Public rooms**: open, anyone can join.
- **Private rooms**: created and shared via link/code with friends.
- **Capacity**: up to **50 players** in a private room.
- **No account required**: players join instantly with just a chosen **nickname**.
- Lobby shows current players before the game starts; host (room creator) controls start/settings.
- **Single-room membership**: a player can only be active in one room at a time. If a player joins a different room, they are first removed from any room they were already in. If that vacated room reaches **0 players**, it is deleted immediately (not left to passive TTL expiry).

## Core Features (initial scope)

- Room creation (public/private) and instant join via code/link.
- Nickname selection per session (no auth).
- Championship Mode and Race Mode game logic.
- Shared real-time board: every player's guesses, attempt count, and letter feedback (colors + positions) visible to all players in the room as they happen.
- Flexible letter input: within the active guess row, a player can reposition the cursor with arrow keys or by clicking/tapping any cell, then insert/overwrite the letter at that position — not limited to typing strictly left-to-right from the first empty cell.
- Scoring (Championship Mode) and race-to-finish detection (Race Mode).
- Brazilian Portuguese word list/dictionary for secret words and valid-guess validation: fixed 5-letter length, accent-insensitive matching (base letter matches its accented counterpart), no repeat-avoidance — the same word can legitimately reappear across games/sessions.
- After a game finishes, a new match automatically begins after a 5-second countdown, preserving the room and its current players.
- local player's word grid remains fixed in place, while other players' word grids stay permanently on the left side of the screen with all attempt rows pre-rendered from the start to prevent layout shifts, up to down.
- keyboard is permanently anchored to the bottom of the screen across all game modes and screen sizes.
- room settings allow selecting from 30 seconds to 10 minutes per round, with values stored internally as milliseconds but not be visible to user.
- if no player guesses the current word within the initial 6 attempts, every eligible player receives 2 additional attempts on the same word before the game advances.
- when a player finishes all words and wins the race, a winner modal is immediately displayed to every player in the room before the end-of-race summary is shown.

## Planned Features (singleplayer)

- Three daily singleplayer games — Termo (1 word / 6 attempts), Dueto (2 words / 7 attempts), Quarteto (4 words / 9 attempts) — each with its own date-seeded secret word(s), shared globally across all players for the day.
- Multi-board guess input: one typed guess is submitted once and scored against every still-unsolved board in the puzzle simultaneously (Dueto, Quarteto).
- Results/streak tracking is a client-local concern (e.g. `localStorage`) unless/until accounts exist — no per-player server-side history is in scope yet.

## Out of scope (for now)

- Native mobile apps (web-first, responsive web app).
- Persistent accounts, friend lists, monetization.
- Languages other than Brazilian Portuguese.
- Spectator mode, custom/user-submitted word lists, voice chat.

## Product Principles

- **Instant play**: nickname + room code is enough — zero signup friction. Singleplayer games go further: no nickname, no code, just open the page.
- **Fair word resolution**: the secret words and the correctness/feedback of any guess must be validated server-side only — never trust or leak answers client-side before a word is resolved. This applies equally to the daily singleplayer puzzles, even without a room/session.
- **Real-time fairness**: in a 50-player room, all attempts and feedback must broadcast with low latency and consistent ordering so "fewest attempts" (Championship Mode) and "first to finish" (Race Mode) are determined unambiguously and fairly.
- **Shared daily fairness**: singleplayer puzzles must resolve to the exact same word(s) for every player on a given calendar day, independent of server instance or request time, so results are comparable.
- **Resilient state**: a player refreshing/reconnecting mid-game should not lose their progress or break the room for others.
