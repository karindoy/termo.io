package io.termo.domain.valueobjects

enum class LetterStatus(val wire: String) {
    CORRECT("correct"),
    PRESENT("present"),
    ABSENT("absent"),
}

data class LetterFeedback(val letter: String, val status: LetterStatus)

typealias GuessFeedback = List<LetterFeedback>

fun isSolved(feedback: GuessFeedback): Boolean = feedback.all { it.status == LetterStatus.CORRECT }
