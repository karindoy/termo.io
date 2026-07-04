import { describe, expect, it } from 'vitest';
import { DailyWordResolver } from './daily-word-resolver.js';
import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';

class FixedListWordRepository implements WordRepository {
  constructor(private readonly words: string[]) {}

  getRandomWord(): Word {
    return Word.create(this.words[0]!);
  }

  isValidGuess(): boolean {
    return true;
  }

  getWordAt(index: number): Word {
    return Word.create(this.words[index % this.words.length]!);
  }

  size(): number {
    return this.words.length;
  }
}

const WORDS = ['TERMO', 'PONTE', 'PRATO', 'LIVRO', 'CASAS', 'FALAR', 'NOITE', 'RIVER'];

describe('DailyWordResolver', () => {
  it('resolves the same word(s) for the same date + mode, every time', () => {
    const resolver = new DailyWordResolver(new FixedListWordRepository(WORDS));

    const first = resolver.resolve('2026-07-04', 'termo', 1);
    const second = resolver.resolve('2026-07-04', 'termo', 1);

    expect(first.map((w) => w.value)).toEqual(second.map((w) => w.value));
  });

  it('resolves different words for a different date', () => {
    const resolver = new DailyWordResolver(new FixedListWordRepository(WORDS));

    const day1 = resolver.resolve('2026-07-04', 'termo', 1);
    const day2 = resolver.resolve('2026-07-05', 'termo', 1);

    expect(day1.map((w) => w.value)).not.toEqual(day2.map((w) => w.value));
  });

  it('resolves different words for a different mode on the same date', () => {
    const resolver = new DailyWordResolver(new FixedListWordRepository(WORDS));

    const termo = resolver.resolve('2026-07-04', 'termo', 1);
    const dueto = resolver.resolve('2026-07-04', 'dueto', 1);

    expect(termo.map((w) => w.value)).not.toEqual(dueto.map((w) => w.value));
  });

  it('never picks the same word twice within a single multi-word puzzle', () => {
    const resolver = new DailyWordResolver(new FixedListWordRepository(WORDS));

    const words = resolver.resolve('2026-07-04', 'quarteto', 4).map((w) => w.value);

    expect(new Set(words).size).toBe(4);
  });
});
