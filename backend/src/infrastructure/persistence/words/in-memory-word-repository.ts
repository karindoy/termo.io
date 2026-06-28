import { Word } from '../../../domain/entities/word.js';
import type { WordRepository } from '../../../domain/repositories/word-repository.js';
import { normalizeWord } from '../../../domain/value-objects/normalize-letter.js';

const SECRET_WORDS = [
  'TERMO',
  'PONTE',
  'GATOS',
  'FELIZ',
  'NUVEM',
  'PRATO',
  'LIVRO',
  'VERDE',
  'FORTE',
  'ÁGUAS',
  'MAÇÃS',
  'CARRO',
  'MUNDO',
  'NOITE',
  'FOGOS',
];

const EXTRA_ALLOWED_GUESSES = [
  'PEDRA',
  'FALAR',
  'AMIGO',
  'CASAS',
  'PERNA',
  'BOLSA',
  'CAIXA',
  'FESTA',
  'NORTE',
  'LAGOA',
  'RIVAL',
  'SONHO',
  'TEMPO',
  'VIRAR',
  'BRAVO',
  'DOCES',
  'FILHO',
  'GENTE',
  'HORAS',
  'IDEIA',
  'JOGOS',
  'LARGO',
  'MARCA',
  'NOVOS',
  'OBRAS',
  'PAPEL',
  'QUASE',
  'RÁDIO',
  'SALAS',
  'TARDE',
  'UNIÃO',
  'VALOR',
  'ZEBRA',
  'BANCO',
  'CARTA',
  'DENTE',
  'FRUTA',
  'GRAVE',
  'HOTEL',
  'IGUAL',
  'LIMÃO',
  'MOEDA',
  'NADAR',
  'OUTRO',
  'PORTA',
  'QUEDA',
  'SALTO',
  'TOMAR',
  'USINA',
  'VOLTA',
  'ZONAS',
  'ARROZ',
  'BICHO',
  'CABOS',
  'FIBRA',
  'HUMOR',
];

// The dictionary of words a player is allowed to type is intentionally larger
// than the pool of possible secret words — only a fraction of valid guesses
// should ever be the actual answer.
const ALLOWED_GUESSES = [...SECRET_WORDS, ...EXTRA_ALLOWED_GUESSES];

export class InMemoryWordRepository implements WordRepository {
  private readonly normalizedAllowedGuesses = new Set(ALLOWED_GUESSES.map(normalizeWord));

  getRandomWord(): Word {
    const value = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)]!;
    return Word.create(value);
  }

  isValidGuess(value: string): boolean {
    return this.normalizedAllowedGuesses.has(normalizeWord(value));
  }
}
