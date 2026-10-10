package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.application.gamemodes.GameOptionsInput
import io.termo.application.gamemodes.RaceOptionsInput
import io.termo.domain.errors.RoomAlreadyStartedError
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.errors.UnauthorizedHostActionError
import io.termo.domain.repositories.RoomMode
import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomStatus
import io.termo.domain.valueobjects.RoomSettingsInput
import io.termo.domain.valueobjects.mergeRoomSettings
import io.termo.infrastructure.realtime.RoomLocks

data class UpdateRoomSettingsInput(
    val code: String,
    val playerId: String,
    val settings: RoomSettingsInput,
)

fun updateRoomSettings(deps: RoomDeps, input: UpdateRoomSettingsInput): RoomRecord =
    RoomLocks.withLock(input.code) { updateRoomSettingsLocked(deps, input) }

private fun updateRoomSettingsLocked(deps: RoomDeps, input: UpdateRoomSettingsInput): RoomRecord {
    val record = deps.roomRepository.findByCode(input.code)
        ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")
    if (record.hostId != input.playerId) {
        throw UnauthorizedHostActionError("Somente o host pode alterar as configurações da sala")
    }
    if (record.status != RoomStatus.LOBBY) {
        throw RoomAlreadyStartedError("Sala \"${input.code}\" já foi iniciada")
    }

    val settings = mergeRoomSettings(record.settings, input.settings)
    record.settings = settings

    when (record.mode) {
        RoomMode.CHAMPIONSHIP -> deps.championshipRegistry.get(record.code)?.updateOptions(
            GameOptionsInput(
                wordCount = settings.wordCount,
                maxAttempts = settings.maxAttempts,
                timeLimitMs = settings.timeLimitMs,
            ),
        )

        RoomMode.RACE -> deps.raceRegistry.get(record.code)?.updateOptions(
            RaceOptionsInput(
                wordCount = settings.wordCount,
                timeLimitMs = settings.timeLimitMs,
            ),
        )
    }

    deps.roomRepository.save(record)
    return record
}
