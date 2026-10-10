package io.termo.domain.entities

import io.termo.domain.errors.AttemptsExceededError
import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.errors.RoundAlreadyResolvedError
import io.termo.domain.services.computeFeedback
import io.termo.domain.valueobjects.isSolved

enum class RoundResolutionReason(val wire: String) {
    SOLVED("solved"),
    TIMEOUT("timeout"),
    EXHAUSTED("exhausted"),
}

class WordRound(
    val secretWord: Word,
    var maxAttempts: Int,
    val timeLimitMs: Long,
) {
    val attempts = mutableListOf<Attempt>()
    val startedAt: Long = System.currentTimeMillis()
    var resolved: Boolean = false
    var resolvedReason: RoundResolutionReason? = null

    /** First player, chronologically, whose guess matched the secret word. */
    var solvedBy: String? = null

    /** Every player who has solved this word so far, keyed by playerId, holding the attempt
     * that solved it for them (its attemptNumber is how many guesses they needed). Championship
     * mode uses this to award the word to whoever solved it in the fewest attempts, rather than
     * whoever solved it first. */
    val solvedAttempts = LinkedHashMap<String, Attempt>()

    var extraAttemptsGranted: Boolean = false

    fun grantExtraAttempts(count: Int) {
        maxAttempts += count
        extraAttemptsGranted = true
    }

    fun attemptsFor(playerId: String): List<Attempt> = attempts.filter { it.playerId == playerId }

    fun submitGuess(playerId: String, nickname: String, guessValue: String): Attempt {
        if (resolved) {
            throw RoundAlreadyResolvedError("Esta palavra já foi resolvida")
        }
        if (solvedAttempts.containsKey(playerId)) {
            throw AttemptsExceededError("Você já resolveu esta palavra")
        }
        if (guessValue.length != WORD_LENGTH) {
            throw InvalidGuessError("Guess must be exactly $WORD_LENGTH letters")
        }
        if (attemptsFor(playerId).size >= maxAttempts) {
            throw AttemptsExceededError("Você esgotou suas tentativas nesta palavra")
        }

        val feedback = computeFeedback(secretWord, guessValue)
        val attempt = Attempt(
            playerId = playerId,
            nickname = nickname,
            guess = guessValue.uppercase(),
            feedback = feedback,
            attemptNumber = attemptsFor(playerId).size + 1,
            createdAt = System.currentTimeMillis(),
        )

        attempts.add(attempt)

        if (isSolved(feedback)) {
            if (solvedBy == null) solvedBy = playerId
            solvedAttempts[playerId] = attempt
        }

        return attempt
    }

    /** True once a player has either solved the word or used up their attempts. */
    fun hasFinished(playerId: String): Boolean =
        solvedAttempts.containsKey(playerId) || attemptsFor(playerId).size >= maxAttempts

    fun allPlayersFinished(connectedPlayerIds: List<String>): Boolean =
        connectedPlayerIds.isNotEmpty() && connectedPlayerIds.all { hasFinished(it) }

    /** The player who solved the word in the fewest attempts; ties go to whoever solved it
     * first. Returns null if nobody has solved it (yet). */
    fun bestSolver(): Pair<String, Attempt>? {
        var best: Pair<String, Attempt>? = null
        for ((playerId, attempt) in solvedAttempts) {
            val current = best
            if (current == null ||
                attempt.attemptNumber < current.second.attemptNumber ||
                (attempt.attemptNumber == current.second.attemptNumber && attempt.createdAt < current.second.createdAt)
            ) {
                best = playerId to attempt
            }
        }
        return best
    }

    fun isExpired(now: Long): Boolean = now - startedAt >= timeLimitMs

    fun resolve(reason: RoundResolutionReason, winnerId: String? = null) {
        if (resolved) return
        resolved = true
        resolvedReason = reason
        if (reason == RoundResolutionReason.SOLVED) {
            solvedBy = winnerId ?: solvedBy
        }
    }
}
