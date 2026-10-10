package io.termo.domain.entities

import io.termo.domain.errors.AttemptsExceededError
import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.services.computeFeedback
import io.termo.domain.valueobjects.GuessFeedback
import io.termo.domain.valueobjects.isSolved

data class DailyBoardAttempt(
    val guess: String,
    val feedback: GuessFeedback,
    val attemptNumber: Int,
)

data class DailyBoardResult(
    val attempts: List<DailyBoardAttempt>,
    val solved: Boolean,
    /** Only populated once this board is solved or the puzzle is out of attempts. */
    val revealedWord: String?,
)

data class DailyPuzzleResult(
    val boards: List<DailyBoardResult>,
    val attemptsUsed: Int,
    val maxAttempts: Int,
    val finished: Boolean,
    val won: Boolean,
)

/** A daily puzzle has `secretWords.size` boards open at once against one shared attempt
 * budget (`maxAttempts`) — Termo has 1 board, Dueto 2, Quarteto 4. There is no persisted
 * server-side state between requests: the caller resends the full ordered guess history
 * every time and [replay] recomputes everything from scratch, stopping a board's guess
 * stream the moment it's solved while still counting every guess once toward the budget. */
class DailyPuzzle(
    val secretWords: List<Word>,
    val maxAttempts: Int,
) {
    fun replay(guesses: List<String>): DailyPuzzleResult {
        if (guesses.size > maxAttempts) {
            throw AttemptsExceededError("Número de tentativas excede o limite do dia")
        }
        for (guess in guesses) {
            if (guess.length != WORD_LENGTH) {
                throw InvalidGuessError("A palavra deve ter exatamente $WORD_LENGTH letras")
            }
        }

        val boards = secretWords.map { replayBoard(it, guesses) }
        val won = boards.all { it.solved }
        val finished = won || guesses.size >= maxAttempts

        return DailyPuzzleResult(
            boards = boards,
            attemptsUsed = guesses.size,
            maxAttempts = maxAttempts,
            finished = finished,
            won = won,
        )
    }

    private fun replayBoard(secretWord: Word, guesses: List<String>): DailyBoardResult {
        val attempts = mutableListOf<DailyBoardAttempt>()
        var solved = false

        for (guess in guesses) {
            if (solved) break
            val feedback = computeFeedback(secretWord, guess)
            attempts.add(
                DailyBoardAttempt(
                    guess = guess.uppercase(),
                    feedback = feedback,
                    attemptNumber = attempts.size + 1,
                ),
            )
            if (isSolved(feedback)) solved = true
        }

        val finished = solved || guesses.size >= maxAttempts
        return DailyBoardResult(
            attempts = attempts,
            solved = solved,
            revealedWord = if (finished) secretWord.value else null,
        )
    }
}
