package io.termo.domain.entities

import io.termo.domain.errors.InvalidWordError
import java.util.Locale

const val WORD_LENGTH = 5

/** A secret/guessable word. Guarantees the fixed [WORD_LENGTH] invariant on construction. */
class Word private constructor(val value: String) {

    companion object {
        fun create(value: String): Word {
            if (value.length != WORD_LENGTH) {
                throw InvalidWordError("Word must be exactly $WORD_LENGTH letters: \"$value\"")
            }
            return Word(value.uppercase(Locale.ROOT))
        }
    }

    override fun equals(other: Any?): Boolean = other is Word && other.value == value

    override fun hashCode(): Int = value.hashCode()

    override fun toString(): String = value
}
