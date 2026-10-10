package io.termo.presentation.dto

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty
import io.termo.domain.repositories.RoomRecord

data class RoomPlayerDto(
    val playerId: String,
    val nickname: String,
)

data class RoomSettingsDto(
    val wordCount: Int,
    val maxAttempts: Int,
    val timeLimitMs: Long,
)

data class RoomRecordDto(
    val code: String,
    val mode: String,
    val hostId: String,
    val createdAt: Long,
    @param:JsonProperty("isPublic") @get:JsonProperty("isPublic") val isPublic: Boolean,
    val settings: RoomSettingsDto,
    val status: String,
    val players: List<RoomPlayerDto>,
)

data class RoomSessionDto(
    val sessionSecret: String,
)

data class HostMigratedDto(
    val code: String,
    val hostId: String,
)

data class CountdownStartedDto(
    val code: String,
    val seconds: Int,
    val reason: String,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class ErrorDto(
    val message: String,
    val code: String? = null,
)

fun RoomRecord.toDto(): RoomRecordDto = RoomRecordDto(
    code = code,
    mode = mode.wire,
    hostId = hostId,
    createdAt = createdAt,
    isPublic = isPublic,
    settings = settings.toDto(),
    status = status.wire,
    players = players.map { RoomPlayerDto(it.playerId, it.nickname) },
)

fun io.termo.domain.valueobjects.RoomSettings.toDto(): RoomSettingsDto =
    RoomSettingsDto(wordCount = wordCount, maxAttempts = maxAttempts, timeLimitMs = timeLimitMs)
