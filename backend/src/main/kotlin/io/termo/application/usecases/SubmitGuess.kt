package io.termo.application.usecases

import io.termo.application.gamemodes.GameMode
import io.termo.domain.entities.Attempt

data class SubmitGuessInput(
    val playerId: String,
    val nickname: String,
    val guess: String,
)

data class SubmitGuessResult(
    val attempt: Attempt,
    val solved: Boolean,
    val winnerId: String?,
)

fun submitGuess(gameMode: GameMode, input: SubmitGuessInput): SubmitGuessResult {
    val attempt = gameMode.submitGuess(input.playerId, input.nickname, input.guess)
    return SubmitGuessResult(
        attempt = attempt,
        solved = gameMode.isResolved(),
        winnerId = gameMode.getWinner(),
    )
}
