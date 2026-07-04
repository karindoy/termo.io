import type { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';

// Determinism matters here, not unpredictability/security — the whole point is that every
// player, on any server instance, recomputes the exact same word(s) for a given date+mode
// with no shared "today's word" record to write or invalidate. FNV-1a is a small,
// well-known non-cryptographic hash, good enough for that.
function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Picks `wordCount` distinct, date-seeded words from the dictionary for a given puzzle
 * date + mode. Same date + mode always resolves to the same words — no persistence. */
export class DailyWordResolver {
  constructor(private readonly wordRepository: WordRepository) {}

  resolve(date: string, mode: string, wordCount: number): Word[] {
    const size = this.wordRepository.size();
    const baseSeed = fnv1aHash(`${date}:${mode}`);

    const chosenIndices = new Set<number>();
    const words: Word[] = [];
    let step = 0;
    while (words.length < wordCount) {
      const index = fnv1aHash(`${baseSeed}:${step}`) % size;
      step += 1;
      if (chosenIndices.has(index)) continue;
      chosenIndices.add(index);
      words.push(this.wordRepository.getWordAt(index));
    }
    return words;
  }
}
