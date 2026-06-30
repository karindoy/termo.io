---
inclusion: always
---

# Product Overview

**termo.io** — a competitive, multiplayer Brazilian Portuguese word-guessing game (Wordle-style, "Termo") played in rooms.

## Core Concept

Players join a room and compete to guess hidden Brazilian Portuguese words. Every word is always **exactly 5 letters**. Each room plays a sequence of **5 words** per game. Feedback per guess uses standard Wordle-style coloring:

- **Green**: correct letter in the correct position.
- **Yellow**: correct letter, wrong position.
- (Implicit) **Gray/none**: letter not in the word.

**Accent-insensitive matching**: a secret word may contain accented letters (â, ã, á, à, ç, etc.). Typing the unaccented base letter still counts as a correct match — e.g. if the secret word has **â**, guessing plain **a**/**A** in that position is green; if it has **ç**, guessing **c** is green. Players never need an accented keyboard to play correctly; the revealed word still shows the real accented spelling once solved.

All players in a room see each other's nickname, attempts, letter colors, and positions in real time — guesses are not private, the board is shared/visible to everyone.

## Target Users

- Brazilian Portuguese speakers who enjoy word-guessing games and want a competitive, social version of the genre.
- Friend groups wanting to play together in a private room.
- Casual players who want to jump into a public room instantly, no signup.

## Game Modes

### Championship Mode
- 5 words per game.
- Each word allows a **maximum of 6 attempts** per player.
- For each word, the **first player to guess correctly scores a point**.
- After a word is resolved (someone guesses it, or all eligible attempts are exhausted), the room moves to the next word.
- Winner = highest score after 5 words.

### Race Mode (Time Attack)
- 5 words per game.
- **Infinite attempts** per word (no 6-attempt cap).
- The **first player to correctly guess all words wins the game** — it's a race, not a per-word point system.

## Rooms

- **Public rooms**: open, anyone can join.
- **Private rooms**: created and shared via link/code with friends.
- **Capacity**: up to **50 players** in a private room.
- **No account required**: players join instantly with just a chosen **nickname**.
- Lobby shows current players before the game starts; host (room creator) controls start/settings.

## Core Features (initial scope)

- Room creation (public/private) and instant join via code/link.
- Nickname selection per session (no auth).
- Championship Mode and Race Mode game logic.
- Shared real-time board: every player's guesses, attempt count, and letter feedback (colors + positions) visible to all players in the room as they happen.
- Flexible letter input: within the active guess row, a player can reposition the cursor with arrow keys or by clicking/tapping any cell, then insert/overwrite the letter at that position — not limited to typing strictly left-to-right from the first empty cell.
- Scoring (Championship Mode) and race-to-finish detection (Race Mode).
- Brazilian Portuguese word list/dictionary for secret words and valid-guess validation: fixed 5-letter length, accent-insensitive matching (base letter matches its accented counterpart), no repeat-avoidance — the same word can legitimately reappear across games/sessions.

## Out of scope (for now)

- Native mobile apps (web-first, responsive web app).
- Persistent accounts, friend lists, monetization.
- Languages other than Brazilian Portuguese.
- Spectator mode, custom/user-submitted word lists, voice chat.

## Product Principles

- **Instant play**: nickname + room code is enough — zero signup friction.
- **Fair word resolution**: the secret words and the correctness/feedback of any guess must be validated server-side only — never trust or leak answers client-side before a word is resolved.
- **Real-time fairness**: in a 50-player room, all attempts and feedback must broadcast with low latency and consistent ordering so "first correct guess" (Championship Mode) and "first to finish" (Race Mode) are determined unambiguously and fairly.
- **Resilient state**: a player refreshing/reconnecting mid-game should not lose their progress or break the room for others.
