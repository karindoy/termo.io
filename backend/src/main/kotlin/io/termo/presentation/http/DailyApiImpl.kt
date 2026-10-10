package io.termo.presentation.http

import io.termo.application.gamemodes.DAILY_MODE_CONFIG
import io.termo.application.gamemodes.DailyGameMode
import io.termo.application.usecases.daily.SubmitDailyGuessInput
import io.termo.application.usecases.daily.submitDailyGuess
import io.termo.domain.repositories.WordRepository
import io.termo.presentation.api.DailyApi
import io.termo.presentation.api.model.DailyGuessRequest
import jakarta.inject.Inject
import jakarta.inject.Singleton
import jakarta.ws.rs.core.MediaType
import jakarta.ws.rs.core.Response

/** Implements the OpenAPI-generated [DailyApi] contract. */
@Singleton
class DailyApiImpl @Inject constructor(
    private val wordRepository: WordRepository,
) : DailyApi {

    override fun getDailyConfig(mode: String): Response {
        val dailyMode = DailyGameMode.fromWire(mode) ?: return modeNotFound(mode)
        return Response.ok(DAILY_MODE_CONFIG.getValue(dailyMode).toApiModel())
            .type(MediaType.APPLICATION_JSON)
            .build()
    }

    override fun submitDailyGuess(mode: String, dailyGuessRequest: DailyGuessRequest): Response {
        val dailyMode = DailyGameMode.fromWire(mode) ?: return modeNotFound(mode)
        val result = submitDailyGuess(
            wordRepository,
            SubmitDailyGuessInput(mode = dailyMode, guesses = dailyGuessRequest.guesses!!),
        )
        return Response.ok(result.toApiModel()).type(MediaType.APPLICATION_JSON).build()
    }

    private fun modeNotFound(mode: String): Response =
        Response.status(Response.Status.NOT_FOUND)
            .entity(apiError("Modo diário \"$mode\" não encontrado"))
            .type(MediaType.APPLICATION_JSON)
            .build()
}
