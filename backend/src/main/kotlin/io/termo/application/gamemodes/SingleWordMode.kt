package io.termo.application.gamemodes

import io.termo.domain.entities.Attempt
import io.termo.domain.entities.Player
import io.termo.domain.entities.Room
import io.termo.domain.entities.WordRound
import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.repositories.WordRepository
import io.termo.infrastructure.realtime.GameTimers

private const val NO_ATTEMPT_LIMIT = Int.MAX_VALUE
private const val NO_TIME_LIMIT = Long.MAX_VALUE

/** Single-word, single-room mode retained for parity; the shipped multiplayer rooms use
 * [ChampionshipMode] and [RaceMode]. */
class SingleWordMode(
    private val roomId: String,
    private val wordRepository: WordRepository,
    private val timers: GameTimers,
) : GameMode {

    private var room: Room? = null
    private var round: WordRound? = null

    override fun start() {
        room = Room(roomId)
        val word = wordRepository.getRandomWord()
        round = WordRound(word, NO_ATTEMPT_LIMIT, NO_TIME_LIMIT)
    }

    override fun joinPlayer(playerId: String, nickname: String) {
        val room = room ?: Room(roomId).also { room = it }
        room.addPlayer(Player(playerId, nickname))
    }

    override fun submitGuess(playerId: String, nickname: String, guess: String): Attempt {
        val room = requireRoom()
        val round = requireRound()

        if (!wordRepository.isValidGuess(guess)) {
            throw InvalidGuessError("\"$guess\" não está na lista de palavras")
        }

        if (!room.players.containsKey(playerId)) {
            room.addPlayer(Player(playerId, nickname))
        }

        return round.submitGuess(playerId, nickname, guess)
    }

    override fun isResolved(): Boolean = round?.solvedBy != null

    override fun getWinner(): String? = round?.solvedBy

    fun getRoom(): Room = requireRoom()

    fun getRound(): WordRound = requireRound()

    private fun requireRoom(): Room = room ?: throw IllegalStateException("Game has not started yet")

    private fun requireRound(): WordRound = round ?: throw IllegalStateException("Game has not started yet")
}
