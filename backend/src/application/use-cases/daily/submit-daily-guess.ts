import { DailyPuzzle, type DailyPuzzleResult } from '../../../domain/entities/daily-puzzle.js';
import { WORD_LENGTH } from '../../../domain/entities/word.js';
import { InvalidGuessError } from '../../../domain/errors/invalid-guess-error.js';
import { AttemptsExceededError } from '../../../domain/errors/attempts-exceeded-error.js';
import { currentPuzzleDate } from '../../../domain/value-objects/puzzle-date.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { DailyWordResolver } from '../../../infrastructure/persistence/words/daily-word-resolver.js';
import { DAILY_MODE_CONFIG, type DailyGameMode } from '../../game-modes/daily-modes/daily-mode-config.js';

export interface SubmitDailyGuessDeps {
  wordRepository: WordRepository;
}

export interface SubmitDailyGuessInput {
  mode: DailyGameMode;
  /** Full ordered guess history so far, newest last — the caller (frontend) is the only
   * place this is persisted (see product.md: no per-player server-side history). */
  guesses: string[];
}

export function submitDailyGuess(deps: SubmitDailyGuessDeps, input: SubmitDailyGuessInput): DailyPuzzleResult {
  const config = DAILY_MODE_CONFIG[input.mode];

  if (input.guesses.length === 0) {
    throw new InvalidGuessError('Nenhuma tentativa enviada');
  }
  if (input.guesses.length > config.maxAttempts) {
    throw new AttemptsExceededError('Número de tentativas excede o limite do dia');
  }

  const newestGuess = input.guesses[input.guesses.length - 1]!;
  if (newestGuess.length !== WORD_LENGTH) {
    throw new InvalidGuessError(`A palavra deve ter exatamente ${WORD_LENGTH} letras`);
  }
  if (!deps.wordRepository.isValidGuess(newestGuess)) {
    throw new InvalidGuessError(`"${newestGuess}" não está na lista de palavras`);
  }

  const date = currentPuzzleDate();
  const resolver = new DailyWordResolver(deps.wordRepository);
  const secretWords = resolver.resolve(date, input.mode, config.wordCount);
  const puzzle = new DailyPuzzle(secretWords, config.maxAttempts);

  return puzzle.replay(input.guesses);
}
