package io.termo.application.gamemodes

import io.termo.domain.entities.Attempt
import io.termo.domain.entities.Game
import io.termo.domain.entities.GameOptions
import io.termo.domain.entities.GamePhase
import io.termo.domain.entities.GameStatus
import io.termo.domain.entities.Player
import io.termo.domain.entities.Room
import io.termo.domain.entities.RoundResolutionReason
import io.termo.domain.entities.RoundResolutionReason.EXHAUSTED
import io.termo.domain.entities.RoundResolutionReason.SOLVED
import io.termo.domain.entities.RoundResolutionReason.TIMEOUT
import io.termo.domain.entities.RoundResolutionResult
import io.termo.domain.entities.WORD_LENGTH
import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.repositories.WordRepository
import io.termo.infrastructure.realtime.GameTimers
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ScheduledFuture

data class GameOptionsInput(
    val wordCount: Int? = null,
    val maxAttempts: Int? = null,
    val timeLimitMs: Long? = null,
)

class ChampionshipMode(
    private val roomId: String,
    private val wordRepository: WordRepository,
    private val timers: GameTimers,
    options: GameOptions = DEFAULT_OPTIONS,
) : GameMode {

    private var room: Room? = null
    private var game: Game? = null
    private var timeoutHandle: ScheduledFuture<*>? = null
    private var options: GameOptions = options
    private val events = CopyOnWriteArrayList<ChampionshipEvents>()

    fun addEvents(listener: ChampionshipEvents) {
        events.add(listener)
    }

    override fun start() {
        if (room == null) room = Room(roomId)
        game = Game(wordRepository, options)
        scheduleTimeout()
        emitRoundStarted()
    }

    fun updateOptions(input: GameOptionsInput) {
        options = options.copy(
            wordCount = input.wordCount ?: options.wordCount,
            maxAttempts = input.maxAttempts ?: options.maxAttempts,
            timeLimitMs = input.timeLimitMs ?: options.timeLimitMs,
        )
    }

    override fun joinPlayer(playerId: String, nickname: String) {
        val room = room ?: Room(roomId).also { room = it }
        room.addPlayer(Player(playerId, nickname))
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

        val attempt = game.submitGuess(playerId, nickname, guess)
        checkRoundCompletion()
        return attempt
    }

    override fun isResolved(): Boolean = game?.phase == GamePhase.FINISHED

    override fun getWinner(): String? = game?.winnerIds?.firstOrNull()

    fun getRoom(): Room = requireRoom()

    fun getGame(): Game = requireGame()

    fun currentRoundSnapshot(): RoundSnapshot {
        val game = requireGame()
        return RoundSnapshot(
            roomId = roomId,
            roundSequence = game.roundSequenceNumber,
            wordIndex = game.wordIndexNumber,
            wordCount = options.wordCount,
            wordLength = WORD_LENGTH,
            maxAttempts = game.currentRound.maxAttempts,
            timeLimitMs = game.currentRound.timeLimitMs,
            roundStartedAt = game.currentRound.startedAt,
            phase = game.phase.wire,
            tieBreakCandidates = game.tieBreakCandidates,
        )
    }

    private fun checkRoundCompletion() {
        val game = requireGame()
        val round = game.currentRound

        // The word stays open — even after someone solves it — until every player still eligible
        // to guess it has either solved it themselves or run out of attempts, so the round can
        // award the point to whoever solved it in the fewest attempts. During a tie-break, only
        // the tied candidates are eligible, so everyone else must not be counted or the round
        // would hang until its timeout every time.
        if (!round.allPlayersFinished(eligiblePlayerIds(game))) return

        val best = round.bestSolver()
        if (best != null) {
            resolveRound(SOLVED, best.first)
        } else if (!round.extraAttemptsGranted) {
            round.grantExtraAttempts(2)
            val snapshot = currentRoundSnapshot()
            events.forEach { it.onExtraAttempts(snapshot) }
        } else {
            resolveRound(EXHAUSTED, null)
        }
    }

    private fun eligiblePlayerIds(game: Game): List<String> {
        val connectedIds = requireRoom().players.keys.toList()
        val candidates = game.tieBreakCandidates
        if (game.phase == GamePhase.TIE_BREAK && candidates != null) {
            return connectedIds.filter { it in candidates }
        }
        return connectedIds
    }

    private fun resolveRound(reason: RoundResolutionReason, winnerId: String?) {
        clearTimeout()
        val game = requireGame()
        val connectedIds = requireRoom().players.keys.toList()
        val result = game.resolveCurrentRound(reason, winnerId, connectedIds)

        events.forEach { it.onWordResolved(result.toEvent(roomId)) }
        handleResolutionOutcome(result)
    }

    private fun handleResolutionOutcome(result: RoundResolutionResult) {
        if (result.gameStatus == GameStatus.FINISHED) {
            val event = GameFinishedEvent(roomId, result.finalWinnerIds ?: emptyList(), result.scores)
            events.forEach { it.onGameFinished(event) }
            return
        }

        if (result.gameStatus == GameStatus.TIE_BREAK_STARTED) {
            val event = TieBreakStartedEvent(roomId, result.tieBreakCandidates ?: emptyList(), currentRoundSnapshot())
            events.forEach { it.onTieBreakStarted(event) }
        } else {
            emitRoundStarted()
        }

        scheduleTimeout()
    }

    private fun scheduleTimeout() {
        val game = requireGame()
        timeoutHandle = timers.schedule(game.currentRound.timeLimitMs) {
            // Some players may have already solved the word before time ran out for the
            // stragglers — the fastest-by-attempts of them still wins the point.
            val best = game.currentRound.bestSolver()
            resolveRound(if (best != null) SOLVED else TIMEOUT, best?.first)
        }
    }

    private fun emitRoundStarted() {
        val snapshot = currentRoundSnapshot()
        events.forEach { it.onRoundStarted(snapshot) }
    }

    private fun clearTimeout() {
        timeoutHandle?.let { timers.cancel(it) }
        timeoutHandle = null
    }

    private fun requireRoom(): Room = room ?: throw IllegalStateException("Game has not started yet")

    private fun requireGame(): Game = game ?: throw IllegalStateException("Game has not started yet")

    companion object {
        const val DEFAULT_TIE_BREAK_MAX_ATTEMPTS = 3
        const val DEFAULT_TIE_BREAK_TIME_LIMIT_MS = 2 * 60 * 1000L
        val DEFAULT_OPTIONS = GameOptions(
            wordCount = 5,
            maxAttempts = 6,
            timeLimitMs = 5 * 60 * 1000L,
            tieBreakMaxAttempts = DEFAULT_TIE_BREAK_MAX_ATTEMPTS,
            tieBreakTimeLimitMs = DEFAULT_TIE_BREAK_TIME_LIMIT_MS,
        )
    }
}

private fun RoundResolutionResult.toEvent(roomId: String) = WordResolvedEvent(
    roomId = roomId,
    roundSequence = roundSequence,
    wordIndex = wordIndex,
    isTieBreak = isTieBreak,
    reason = reason.wire,
    winnerId = winnerId,
    revealedWord = revealedWord,
    scores = scores,
    gameStatus = gameStatus.wire,
    tieBreakCandidates = tieBreakCandidates,
    finalWinnerIds = finalWinnerIds,
)
