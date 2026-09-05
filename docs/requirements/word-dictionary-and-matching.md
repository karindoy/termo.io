# Word Dictionary & Matching

## Overview

The Brazilian Portuguese word list and the rules for turning a guess into green/yellow/gray feedback — shared by every game mode, multiplayer and daily.

## Business Requirements

1. Every secret word and every valid guess is exactly **5 letters**.
2. Feedback per guess follows standard Wordle-style rules:
   - Green: correct letter, correct position.
   - Yellow: correct letter, wrong position.
   - Gray (unstyled/absent): letter not in the word.
   - Duplicate letters are handled correctly — e.g. guessing a letter twice when the secret word has it only once yields at most one green/yellow and the rest gray.
3. **Accent-insensitive matching**: typing a plain letter matches its accented counterpart in the secret word (e.g. `a` matches `ã`, `c` matches `ç`). Players never need an accented keyboard to play correctly. The real accented spelling is only revealed once a word is solved or the puzzle ends.
4. The same word can legitimately reappear across different games/sessions — there's no repeat-avoidance.
5. Word correctness and feedback are always resolved on the server — the client never receives or computes the secret word itself before it's revealed.

## Technical Requirements

1. Word entity: `backend/src/domain/entities/word.ts` — `Word.create` enforces exactly 5 letters, throwing `InvalidWordError` otherwise (checked at data-load time via the repository, not per-guess).
2. Normalization: `backend/src/domain/value-objects/normalize-letter.ts` — NFD Unicode normalization + stripping combining marks (e.g. `á`→`a`, `ç`→`c`).
3. Feedback algorithm: `backend/src/domain/services/word-matcher.ts`'s `computeFeedback` — standard two-pass Wordle logic (green pass first, then a yellow pass consuming a `remaining` letter-count map built from normalized secret letters not already matched green) using the normalized forms for comparison on both passes. The original accented spelling is preserved and only sent to the client at reveal time.
4. Word list: `backend/src/infrastructure/persistence/words/in-memory-word-repository.ts` loads `wordlist.txt` into memory at module load. `getRandomWord()` uses `Math.random()` over the full list with no exclusion list (no repeat-avoidance). `getWordAt(index)`/`size()` exist specifically to support `DailyWordResolver`'s deterministic indexing (see [daily-singleplayer-games.md](daily-singleplayer-games.md)).
5. Test-only determinism hook: the `E2E_FIXED_WORDS` env var (comma-separated, consumed in draw order) makes `getRandomWord()` cycle through a fixed list instead of using `Math.random()`, letting the e2e suite know secret words in advance to force deterministic scenarios (e.g. a guaranteed tie-break). This is not documented in either steering doc or README today.
6. Word feedback is computed exclusively in backend `domain` and never trusted from or duplicated in the frontend — the frontend only ever renders feedback objects the server sends.

## Acceptance Criteria

- [ ] A guess with a letter appearing twice, when the secret word contains it once, produces exactly one green/yellow and marks the extra occurrence gray.
- [ ] Guessing the unaccented form of an accented secret letter in the right position scores green.
- [ ] The client never receives the secret word before it's solved or the round/puzzle ends (verified by inspecting network payloads, not just UI).
- [ ] The same word can appear in two different games/sessions back to back.
- [ ] Setting `E2E_FIXED_WORDS` makes word selection deterministic for testing.

## Known Issues / Cleanup Notes

- `E2E_FIXED_WORDS` is a real, load-bearing env var for the e2e suite but appears in neither `.kiro/steering/tech.md` nor `README.md`'s environment-variable documentation — only discoverable by reading `e2e/run.sh` and the repository source directly.
