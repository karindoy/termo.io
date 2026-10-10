package io.termo.domain.entities

import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.repositories.WordRepository

enum class GamePhase(val wire: String) {
    PLAYING("playing"),
    TIE_BREAK("tie-break"),
    FINISHED("finished"),
}

enum class GameStatus(val wire: String) {
    CONTINUE("continue"),
    TIE_BREAK_STARTED("tie-break-started"),
    FINISHED("finished"),
}

data class GameOptions(
    val wordCount: Int,
    val maxAttempts: Int,
    val timeLimitMs: Long,
    val tieBreakMaxAttempts: Int,
    val tieBreakTimeLimitMs: Long,
)

data class RoundResolutionResult(
    val roundSequence: Int,
    val wordIndex: Int,
    val isTieBreak: Boolean,
    val reason: RoundResolutionReason,
    val winnerId: String?,
    val revealedWord: String,
    val scores: Map<String, Int>,
    val gameStatus: GameStatus,
    val tieBreakCandidates: List<String>?,
    val finalWinnerIds: List<String>?,
)

class Game(
    private val wordRepository: WordRepository,
    private val options: GameOptions,
) {
    val scores = LinkedHashMap<String, Int>()
    var phase: GamePhase = GamePhase.PLAYING
    var tieBreakCandidates: List<String>? = null
    var winnerIds: List<String>? = null

    private val words: List<Word> = (0 until options.wordCount).map { wordRepository.getRandomWord() }
    private var wordIndex = 0
    private val rounds = mutableListOf(WordRound(words[0], options.maxAttempts, options.timeLimitMs))

    val currentRound: WordRound
        get() = rounds.last()

    val wordIndexNumber: Int
        get() = wordIndex

    val roundSequenceNumber: Int
        get() = rounds.size - 1

    fun submitGuess(playerId: String, nickname: String, guess: String): Attempt {
        if (phase == GamePhase.TIE_BREAK && tieBreakCandidates?.contains(playerId) == false) {
            throw InvalidGuessError("Apenas os jogadores empatados participam do desempate")
        }
        return currentRound.submitGuess(playerId, nickname, guess)
    }

    fun resolveCurrentRound(
        reason: RoundResolutionReason,
        winnerId: String?,
        connectedPlayerIds: List<String>,
    ): RoundResolutionResult {
        val round = currentRound
        round.resolve(reason, winnerId)

        if (reason == RoundResolutionReason.SOLVED && winnerId != null && phase == GamePhase.PLAYING) {
            scores[winnerId] = (scores[winnerId] ?: 0) + 1
        }

        val base = BaseResolution(
            roundSequence = roundSequenceNumber,
            wordIndex = wordIndex,
            isTieBreak = phase == GamePhase.TIE_BREAK,
            reason = reason,
            winnerId = winnerId,
            revealedWord = round.secretWord.value,
            scores = LinkedHashMap(scores),
        )

        if (phase == GamePhase.TIE_BREAK) {
            return advanceTieBreak(base, reason, winnerId)
        }

        return advanceRegularRound(base, connectedPlayerIds)
    }

    private fun advanceTieBreak(
        base: BaseResolution,
        reason: RoundResolutionReason,
        winnerId: String?,
    ): RoundResolutionResult {
        if (reason == RoundResolutionReason.SOLVED && winnerId != null) {
            phase = GamePhase.FINISHED
            winnerIds = listOf(winnerId)
            return base.toResult(GameStatus.FINISHED, tieBreakCandidates, winnerIds)
        }

        val nextWord = wordRepository.getRandomWord()
        rounds.add(WordRound(nextWord, options.tieBreakMaxAttempts, options.tieBreakTimeLimitMs))
        return base.toResult(GameStatus.CONTINUE, tieBreakCandidates, null)
    }

    private fun advanceRegularRound(
        base: BaseResolution,
        connectedPlayerIds: List<String>,
    ): RoundResolutionResult {
        wordIndex += 1

        if (wordIndex < words.size) {
            val nextWord = words[wordIndex]
            rounds.add(WordRound(nextWord, options.maxAttempts, options.timeLimitMs))
            return base.toResult(GameStatus.CONTINUE, null, null)
        }

        val leaders = computeLeaders(connectedPlayerIds)

        if (leaders.size == 1) {
            phase = GamePhase.FINISHED
            winnerIds = leaders
            return base.toResult(GameStatus.FINISHED, null, leaders)
        }

        phase = GamePhase.TIE_BREAK
        tieBreakCandidates = leaders
        val tieBreakWord = wordRepository.getRandomWord()
        rounds.add(WordRound(tieBreakWord, options.tieBreakMaxAttempts, options.tieBreakTimeLimitMs))
        return base.toResult(GameStatus.TIE_BREAK_STARTED, leaders, null)
    }

    private fun computeLeaders(connectedPlayerIds: List<String>): List<String> {
        if (connectedPlayerIds.isEmpty()) return emptyList()
        val maxScore = connectedPlayerIds.maxOf { scores[it] ?: 0 }
        return connectedPlayerIds.filter { (scores[it] ?: 0) == maxScore }
    }

    private data class BaseResolution(
        val roundSequence: Int,
        val wordIndex: Int,
        val isTieBreak: Boolean,
        val reason: RoundResolutionReason,
        val winnerId: String?,
        val revealedWord: String,
        val scores: Map<String, Int>,
    ) {
        fun toResult(
            gameStatus: GameStatus,
            tieBreakCandidates: List<String>?,
            finalWinnerIds: List<String>?,
        ) = RoundResolutionResult(
            roundSequence = roundSequence,
            wordIndex = wordIndex,
            isTieBreak = isTieBreak,
            reason = reason,
            winnerId = winnerId,
            revealedWord = revealedWord,
            scores = scores,
            gameStatus = gameStatus,
            tieBreakCandidates = tieBreakCandidates,
            finalWinnerIds = finalWinnerIds,
        )
    }
}
