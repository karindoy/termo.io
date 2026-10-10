package io.termo.domain.services

import io.termo.domain.entities.Word
import io.termo.domain.entities.WORD_LENGTH
import io.termo.domain.valueobjects.GuessFeedback
import io.termo.domain.valueobjects.LetterFeedback
import io.termo.domain.valueobjects.LetterStatus
import io.termo.domain.valueobjects.normalizeLetter
import java.util.Locale

/** Computes classic Wordle feedback (correct / present / absent), accent- and case-insensitive,
 * with the usual "only as many present copies as remain unmatched" rule. */
fun computeFeedback(secret: Word, guess: String): GuessFeedback {
    val secretLetters = secret.value.map { normalizeLetter(it.toString()) }
    val guessLetters = guess.uppercase(Locale.ROOT).map { normalizeLetter(it.toString()) }

    val statuses = MutableList(WORD_LENGTH) { LetterStatus.ABSENT }
    val remaining = HashMap<String, Int>()

    for (index in 0 until WORD_LENGTH) {
        val secretLetter = secretLetters[index]
        if (guessLetters[index] == secretLetter) {
            statuses[index] = LetterStatus.CORRECT
        } else {
            remaining[secretLetter] = (remaining[secretLetter] ?: 0) + 1
        }
    }

    for (index in 0 until WORD_LENGTH) {
        if (statuses[index] == LetterStatus.CORRECT) continue
        val guessLetter = guessLetters[index]
        val available = remaining[guessLetter] ?: 0
        if (available > 0) {
            statuses[index] = LetterStatus.PRESENT
            remaining[guessLetter] = available - 1
        }
    }

    return statuses.mapIndexed { index, status ->
        LetterFeedback(guess[index].uppercase(Locale.ROOT).toString(), status)
    }
}
