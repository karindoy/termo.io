package io.termo.domain.entities

import io.termo.domain.errors.GameAlreadyFinishedError
import io.termo.domain.repositories.WordRepository

enum class RaceGamePhase(val wire: String) {
    PLAYING("playing"),
    FINISHED("finished"),
}

enum class RaceResolutionReason(val wire: String) {
    SOLVED("solved"),
    TIMEOUT("timeout"),
}

data class RaceGameOptions(
    val wordCount: Int,
    val timeLimitMs: Long,
)

private class PlayerProgress(
    val playerId: String,
    var wordIndex: Int,
    var round: WordRound,
    var allSolved: Boolean,
    var finished: Boolean,
)

data class PlayerWordResolution(
    val playerId: String,
    val wordIndex: Int,
    val reason: RaceResolutionReason,
    val revealedWord: String,
    val hasNextWord: Boolean,
    val playerFinished: Boolean,
    val playerWon: Boolean,
    val gameFinished: Boolean,
    val winnerId: String?,
)

data class PlayerProgressSnapshot(
    val playerId: String,
    val wordIndex: Int,
    val roundStartedAt: Long,
    val finished: Boolean,
    val won: Boolean,
)

class RaceGame(
    private val wordRepository: WordRepository,
    private val options: RaceGameOptions,
) {
    var phase: RaceGamePhase = RaceGamePhase.PLAYING
    var winnerId: String? = null

    private val words: List<Word> = (0 until options.wordCount).map { wordRepository.getRandomWord() }
    private val players = LinkedHashMap<String, PlayerProgress>()

    fun hasPlayer(playerId: String): Boolean = players.containsKey(playerId)

    fun addPlayer(playerId: String) {
        if (players.containsKey(playerId)) return
        players[playerId] = PlayerProgress(
            playerId = playerId,
            wordIndex = 0,
            round = WordRound(words[0], Int.MAX_VALUE, options.timeLimitMs),
            allSolved = true,
            finished = false,
        )
    }

    fun wordIndexFor(playerId: String): Int = requirePlayer(playerId).wordIndex

    fun isFinished(playerId: String): Boolean = requirePlayer(playerId).finished

    fun currentRoundFor(playerId: String): WordRound = requirePlayer(playerId).round

    fun attemptsFor(playerId: String): List<Attempt> = requirePlayer(playerId).round.attempts

    fun progressSummary(): List<PlayerProgressSnapshot> =
        players.values.map { progress ->
            PlayerProgressSnapshot(
                playerId = progress.playerId,
                wordIndex = progress.wordIndex,
                roundStartedAt = progress.round.startedAt,
                finished = progress.finished,
                won = winnerId == progress.playerId,
            )
        }

    fun submitGuess(playerId: String, nickname: String, guessValue: String): Attempt {
        if (phase == RaceGamePhase.FINISHED) {
            throw GameAlreadyFinishedError("O jogo já terminou")
        }
        return requirePlayer(playerId).round.submitGuess(playerId, nickname, guessValue)
    }

    fun resolvePlayerWord(playerId: String, reason: RaceResolutionReason): PlayerWordResolution {
        val progress = requirePlayer(playerId)
        val roundReason =
            if (reason == RaceResolutionReason.SOLVED) RoundResolutionReason.SOLVED else RoundResolutionReason.TIMEOUT
        progress.round.resolve(roundReason, if (reason == RaceResolutionReason.SOLVED) playerId else null)
        if (reason == RaceResolutionReason.TIMEOUT) progress.allSolved = false

        val wordIndex = progress.wordIndex
        val revealedWord = progress.round.secretWord.value
        val nextIndex = wordIndex + 1

        if (nextIndex < words.size) {
            progress.wordIndex = nextIndex
            progress.round = WordRound(words[nextIndex], Int.MAX_VALUE, options.timeLimitMs)
            return PlayerWordResolution(
                playerId = playerId,
                wordIndex = wordIndex,
                reason = reason,
                revealedWord = revealedWord,
                hasNextWord = true,
                playerFinished = false,
                playerWon = false,
                gameFinished = false,
                winnerId = winnerId,
            )
        }

        progress.finished = true
        val playerWon = progress.allSolved

        if (playerWon) {
            phase = RaceGamePhase.FINISHED
            winnerId = playerId
        } else if (allPlayersFinished()) {
            phase = RaceGamePhase.FINISHED
        }

        return PlayerWordResolution(
            playerId = playerId,
            wordIndex = wordIndex,
            reason = reason,
            revealedWord = revealedWord,
            hasNextWord = false,
            playerFinished = true,
            playerWon = playerWon,
            gameFinished = phase == RaceGamePhase.FINISHED,
            winnerId = winnerId,
        )
    }

    private fun allPlayersFinished(): Boolean =
        players.isNotEmpty() && players.values.all { it.finished }

    private fun requirePlayer(playerId: String): PlayerProgress =
        players[playerId] ?: throw IllegalStateException("Player not in game")
}
