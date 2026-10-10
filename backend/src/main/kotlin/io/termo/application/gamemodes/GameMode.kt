package io.termo.application.gamemodes

import io.termo.domain.entities.Attempt

interface GameMode {
    fun start()

    fun joinPlayer(playerId: String, nickname: String)

    fun submitGuess(playerId: String, nickname: String, guess: String): Attempt

    fun isResolved(): Boolean

    fun getWinner(): String?
}
