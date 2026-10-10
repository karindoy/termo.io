package io.termo.presentation.http

import io.termo.application.gamemodes.DailyModeConfig as DomainDailyModeConfig
import io.termo.domain.entities.DailyPuzzleResult as DomainDailyPuzzleResult
import io.termo.domain.repositories.RoomMode as DomainRoomMode
import io.termo.domain.repositories.RoomRecord as DomainRoomRecord
import io.termo.domain.valueobjects.RoomSettings as DomainRoomSettings
import io.termo.domain.valueobjects.RoomSettingsInput as DomainRoomSettingsInput
import io.termo.presentation.api.model.DailyBoardAttempt as ApiDailyBoardAttempt
import io.termo.presentation.api.model.DailyBoardResult as ApiDailyBoardResult
import io.termo.presentation.api.model.DailyModeConfig as ApiDailyModeConfig
import io.termo.presentation.api.model.DailyPuzzleResult as ApiDailyPuzzleResult
import io.termo.presentation.api.model.ErrorResponse as ApiErrorResponse
import io.termo.presentation.api.model.LetterFeedback as ApiLetterFeedback
import io.termo.presentation.api.model.LetterStatus as ApiLetterStatus
import io.termo.presentation.api.model.PublicRoomPlayer as ApiPublicRoomPlayer
import io.termo.presentation.api.model.PublicRoomSummary as ApiPublicRoomSummary
import io.termo.presentation.api.model.RoomMode as ApiRoomMode
import io.termo.presentation.api.model.RoomPlayer as ApiRoomPlayer
import io.termo.presentation.api.model.RoomRecord as ApiRoomRecord
import io.termo.presentation.api.model.RoomSettings as ApiRoomSettings
import io.termo.presentation.api.model.RoomSettingsInput as ApiRoomSettingsInput
import io.termo.presentation.api.model.RoomStatus as ApiRoomStatus

/** Translation between the domain model and the OpenAPI-generated wire models. Keeping this in one
 * place means the generated contract is the single source of truth for the REST surface, and the
 * domain never depends on generated or transport types. */

internal fun apiError(message: String, code: String? = null): ApiErrorResponse =
    ApiErrorResponse().apply {
        this.message = message
        this.code = code
    }

internal fun ApiRoomMode.toDomain(): DomainRoomMode =
    DomainRoomMode.fromWire(this.toString()) ?: throw IllegalArgumentException("Unknown room mode: $this")

internal fun DomainRoomSettings.toApiModel(): ApiRoomSettings {
    val settings = this
    return ApiRoomSettings().apply {
        wordCount = settings.wordCount
        maxAttempts = settings.maxAttempts
        timeLimitMs = settings.timeLimitMs
    }
}

private fun DomainRoomRecord.playersToApi(): List<ApiRoomPlayer> =
    players.map { player -> ApiRoomPlayer().apply { playerId = player.playerId; nickname = player.nickname } }

internal fun DomainRoomRecord.toApiModel(): ApiRoomRecord {
    val record = this
    return ApiRoomRecord().apply {
        code = record.code
        mode = ApiRoomMode.fromValue(record.mode.wire)
        hostId = record.hostId
        createdAt = record.createdAt
        isPublic = record.isPublic
        settings = record.settings.toApiModel()
        status = ApiRoomStatus.fromValue(record.status.wire)
        players = record.playersToApi()
    }
}

internal fun DomainRoomRecord.toApiSummary(): ApiPublicRoomSummary {
    val record = this
    return ApiPublicRoomSummary().apply {
        code = record.code
        mode = ApiRoomMode.fromValue(record.mode.wire)
        isPublic = record.isPublic
        settings = record.settings.toApiModel()
        status = ApiRoomStatus.fromValue(record.status.wire)
        // playerId identifies a seat, not a secret, but an unauthenticated browse list has no
        // reason to hand it out for every room either.
        players = record.players.map { player -> ApiPublicRoomPlayer().apply { nickname = player.nickname } }
    }
}

internal fun ApiRoomSettingsInput?.toDomain(): DomainRoomSettingsInput =
    DomainRoomSettingsInput(
        wordCount = this?.wordCount,
        maxAttempts = this?.maxAttempts,
        timeLimitMs = this?.timeLimitMs,
    )

internal fun DomainDailyModeConfig.toApiModel(): ApiDailyModeConfig {
    val config = this
    return ApiDailyModeConfig().apply {
        wordCount = config.wordCount
        maxAttempts = config.maxAttempts
    }
}

internal fun DomainDailyPuzzleResult.toApiModel(): ApiDailyPuzzleResult {
    val result = this
    return ApiDailyPuzzleResult().apply {
        boards = result.boards.map { board ->
            ApiDailyBoardResult().apply {
                attempts = board.attempts.map { attempt ->
                    ApiDailyBoardAttempt().apply {
                        guess = attempt.guess
                        feedback = attempt.feedback.map { letter ->
                            ApiLetterFeedback().apply {
                                this.letter = letter.letter
                                status = ApiLetterStatus.fromValue(letter.status.wire)
                            }
                        }
                        attemptNumber = attempt.attemptNumber
                    }
                }
                solved = board.solved
                revealedWord = board.revealedWord
            }
        }
        attemptsUsed = result.attemptsUsed
        maxAttempts = result.maxAttempts
        finished = result.finished
        won = result.won
    }
}
