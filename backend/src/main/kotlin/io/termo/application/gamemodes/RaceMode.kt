package io.termo.application.gamemodes

import io.termo.domain.entities.Attempt
import io.termo.domain.entities.Player
import io.termo.domain.entities.RaceGame
import io.termo.domain.entities.RaceGameOptions
import io.termo.domain.entities.RaceGamePhase
import io.termo.domain.entities.RaceResolutionReason
import io.termo.domain.entities.Room
import io.termo.domain.entities.WORD_LENGTH
import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.repositories.WordRepository
import io.termo.infrastructure.realtime.GameTimers
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ScheduledFuture

data class RaceOptionsInput(
    val wordCount: Int? = null,
    val timeLimitMs: Long? = null,
)

class RaceMode(
    private val roomId: String,
    private val wordRepository: WordRepository,
    private val timers: GameTimers,
    options: RaceGameOptions = DEFAULT_OPTIONS,
) : GameMode {

    private var room: Room? = null
    private var game: RaceGame? = null
    private val timeouts = ConcurrentHashMap<String, ScheduledFuture<*>>()
    private var options: RaceGameOptions = options
    private val events = CopyOnWriteArrayList<RaceEvents>()

    fun addEvents(listener: RaceEvents) {
        events.add(listener)
    }

    override fun start() {
        if (room == null) room = Room(roomId)
        game = RaceGame(wordRepository, options)
        events.forEach { it.onRaceStarted(configSnapshot()) }
        // Players who joined during the lobby phase predate this.game — register them now.
        for (player in requireRoom().players.values) {
            ensurePlayerInGame(player.playerId)
        }
    }

    fun updateOptions(input: RaceOptionsInput) {
        options = options.copy(
            wordCount = input.wordCount ?: options.wordCount,
            timeLimitMs = input.timeLimitMs ?: options.timeLimitMs,
        )
    }

    override fun joinPlayer(playerId: String, nickname: String) {
        val room = room ?: Room(roomId).also { room = it }
        room.addPlayer(Player(playerId, nickname))
        if (game != null) ensurePlayerInGame(playerId)
    }

    override fun submitGuess(playerId: String, nickname: String, guess: String): Attempt {
        val room = requireRoom()
        val game = requireGame()

        if (!wordRepository.isValidGuess(guess)) {
            throw InvalidGuessError("\"$guess\" não está na lista de palavras")
        }

        if (!room.players.containsKey(playerId)) {
            room.addPlayer(Player(playerId, nickname))
        }
        ensurePlayerInGame(playerId)

        val attempt = game.submitGuess(playerId, nickname, guess)
        checkPlayerCompletion(playerId)
        return attempt
    }

    override fun isResolved(): Boolean = game?.phase == RaceGamePhase.FINISHED

    override fun getWinner(): String? = game?.winnerId

    fun getRoom(): Room = requireRoom()

    fun getGame(): RaceGame = requireGame()

    fun configSnapshot(): RaceConfigSnapshot = RaceConfigSnapshot(
        roomId = roomId,
        wordCount = options.wordCount,
        wordLength = WORD_LENGTH,
        timeLimitMs = options.timeLimitMs,
    )

    fun playerRoundSnapshot(playerId: String): PlayerRoundSnapshot {
        val game = requireGame()
        return PlayerRoundSnapshot(
            roomId = roomId,
            playerId = playerId,
            wordIndex = game.wordIndexFor(playerId),
            roundStartedAt = game.currentRoundFor(playerId).startedAt,
            finished = game.isFinished(playerId),
        )
    }

    private fun ensurePlayerInGame(playerId: String) {
        val game = requireGame()
        if (game.hasPlayer(playerId)) return
        game.addPlayer(playerId)
        schedulePlayerTimeout(playerId)
        val snapshot = playerRoundSnapshot(playerId)
        events.forEach { it.onPlayerWordStarted(snapshot) }
    }

    private fun checkPlayerCompletion(playerId: String) {
        val round = requireGame().currentRoundFor(playerId)
        if (round.solvedBy != null) {
            resolvePlayerWord(playerId, RaceResolutionReason.SOLVED)
        }
    }

    private fun resolvePlayerWord(playerId: String, reason: RaceResolutionReason) {
        clearPlayerTimeout(playerId)
        val game = requireGame()
        val result = game.resolvePlayerWord(playerId, reason)

        val event = PlayerWordResolvedEvent(
            roomId = roomId,
            playerId = result.playerId,
            wordIndex = result.wordIndex,
            reason = result.reason.wire,
            revealedWord = result.revealedWord,
            hasNextWord = result.hasNextWord,
            playerFinished = result.playerFinished,
            playerWon = result.playerWon,
            gameFinished = result.gameFinished,
            winnerId = result.winnerId,
        )
        events.forEach { it.onPlayerWordResolved(event) }

        if (result.gameFinished) {
            clearAllTimeouts()
            events.forEach { it.onRaceFinished(RaceFinishedEvent(roomId, result.winnerId)) }
            return
        }

        if (result.hasNextWord) {
            schedulePlayerTimeout(playerId)
            val snapshot = playerRoundSnapshot(playerId)
            events.forEach { it.onPlayerWordStarted(snapshot) }
        }
    }

    private fun schedulePlayerTimeout(playerId: String) {
        val round = requireGame().currentRoundFor(playerId)
        val handle = timers.schedule(round.timeLimitMs) {
            resolvePlayerWord(playerId, RaceResolutionReason.TIMEOUT)
        }
        timeouts[playerId]?.let { timers.cancel(it) }
        timeouts[playerId] = handle
    }

    private fun clearPlayerTimeout(playerId: String) {
        timeouts.remove(playerId)?.let { timers.cancel(it) }
    }

    private fun clearAllTimeouts() {
        for (handle in timeouts.values) timers.cancel(handle)
        timeouts.clear()
    }

    private fun requireRoom(): Room = room ?: throw IllegalStateException("Game has not started yet")

    private fun requireGame(): RaceGame = game ?: throw IllegalStateException("Game has not started yet")

    companion object {
        val DEFAULT_OPTIONS = RaceGameOptions(
            wordCount = 5,
            timeLimitMs = 5 * 60 * 1000L,
        )
    }
}
