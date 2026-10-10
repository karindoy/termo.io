package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.repositories.RoomMode
import io.termo.domain.repositories.RoomRecord
import io.termo.infrastructure.realtime.RoomLocks

data class LeaveRoomInput(
    val code: String,
    val playerId: String,
)

data class LeaveRoomResult(
    val code: String,
    /** null once the room has been deleted, i.e. the leaving player was the last one in it. */
    val record: RoomRecord?,
    val hostMigratedTo: String?,
    val deleted: Boolean,
)

fun leaveRoom(deps: RoomDeps, input: LeaveRoomInput): LeaveRoomResult =
    RoomLocks.withLock(input.code) { leaveRoomLocked(deps, input) }

private fun leaveRoomLocked(deps: RoomDeps, input: LeaveRoomInput): LeaveRoomResult {
    val record = deps.roomRepository.findByCode(input.code)
        ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")

    record.players.removeIf { it.playerId == input.playerId }
    deps.roomRepository.clearActiveRoomForPlayer(input.playerId)

    if (record.players.isEmpty()) {
        deps.roomRepository.delete(input.code)
        when (record.mode) {
            RoomMode.CHAMPIONSHIP -> deps.championshipRegistry.remove(input.code)
            RoomMode.RACE -> deps.raceRegistry.remove(input.code)
        }
        deps.sessionStore.clear(input.code)
        return LeaveRoomResult(code = input.code, record = null, hostMigratedTo = null, deleted = true)
    }

    var hostMigratedTo: String? = null
    if (record.hostId == input.playerId) {
        hostMigratedTo = record.players.first().playerId
        record.hostId = hostMigratedTo
    }

    deps.roomRepository.save(record)
    return LeaveRoomResult(code = input.code, record = record, hostMigratedTo = hostMigratedTo, deleted = false)
}
