package io.termo.domain.repositories

import io.termo.domain.entities.Word

interface WordRepository {
    fun getRandomWord(): Word

    fun isValidGuess(value: String): Boolean

    /** Deterministic lookup by position in the dictionary — used to derive the same
     * word(s) for every player from a date-seeded index (see DailyWordResolver). */
    fun getWordAt(index: Int): Word

    fun size(): Int
}
