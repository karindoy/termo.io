package io.termo.application.usecases.daily

import io.termo.application.gamemodes.DAILY_MODE_CONFIG
import io.termo.application.gamemodes.DailyGameMode
import io.termo.domain.entities.DailyPuzzle
import io.termo.domain.entities.DailyPuzzleResult
import io.termo.domain.entities.WORD_LENGTH
import io.termo.domain.errors.AttemptsExceededError
import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.repositories.WordRepository
import io.termo.domain.valueobjects.currentPuzzleDate
import io.termo.infrastructure.persistence.words.DailyWordResolver

data class SubmitDailyGuessInput(
    val mode: DailyGameMode,
    /** Full ordered guess history so far, newest last — the caller (frontend) is the only
     * place this is persisted: there is no per-player server-side history. */
    val guesses: List<String>,
)

fun submitDailyGuess(wordRepository: WordRepository, input: SubmitDailyGuessInput): DailyPuzzleResult {
    val config = DAILY_MODE_CONFIG.getValue(input.mode)

    if (input.guesses.isEmpty()) {
        throw InvalidGuessError("Nenhuma tentativa enviada")
    }
    if (input.guesses.size > config.maxAttempts) {
        throw AttemptsExceededError("Número de tentativas excede o limite do dia")
    }

    val newestGuess = input.guesses.last()
    if (newestGuess.length != WORD_LENGTH) {
        throw InvalidGuessError("A palavra deve ter exatamente $WORD_LENGTH letras")
    }
    if (!wordRepository.isValidGuess(newestGuess)) {
        throw InvalidGuessError("\"$newestGuess\" não está na lista de palavras")
    }

    val date = currentPuzzleDate()
    val secretWords = DailyWordResolver(wordRepository).resolve(date, input.mode.wire, config.wordCount)
    val puzzle = DailyPuzzle(secretWords, config.maxAttempts)

    return puzzle.replay(input.guesses)
}
