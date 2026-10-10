package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.application.gamemodes.GameMode
import io.termo.domain.errors.RoomAlreadyStartedError
import io.termo.domain.errors.RoomFullError
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.repositories.MAX_PLAYERS_PER_ROOM
import io.termo.domain.repositories.RoomMode
import io.termo.domain.repositories.RoomPlayer
import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomStatus
import io.termo.infrastructure.realtime.RoomLocks

data class JoinRoomInput(
    val code: String,
    val playerId: String,
    val nickname: String,
)

data class JoinRoomResult(
    val record: RoomRecord,
    val gameMode: GameMode,
    /** The room (if any) the player was evicted from as a side effect of this join. */
    val previousRoom: LeaveRoomResult?,
)

fun joinRoom(deps: RoomDeps, input: JoinRoomInput): JoinRoomResult =
    RoomLocks.withLock(input.code) { joinRoomLocked(deps, input) }

private fun joinRoomLocked(deps: RoomDeps, input: JoinRoomInput): JoinRoomResult {
    val record = deps.roomRepository.findByCode(input.code)
        ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")

    val alreadyJoined = record.players.any { it.playerId == input.playerId }
    if (!alreadyJoined) {
        if (record.status != RoomStatus.LOBBY) {
            throw RoomAlreadyStartedError("Sala \"${input.code}\" já foi iniciada")
        }
        if (record.players.size >= MAX_PLAYERS_PER_ROOM) {
            throw RoomFullError("Sala \"${input.code}\" está cheia")
        }
    }

    val gameMode: GameMode = when (record.mode) {
        RoomMode.CHAMPIONSHIP -> deps.championshipRegistry.get(record.code)
        RoomMode.RACE -> deps.raceRegistry.get(record.code)
    } ?: run {
        if (record.status == RoomStatus.LOBBY) {
            deps.roomRepository.delete(input.code)
        }
        throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")
    }

    val previousRoom = if (!alreadyJoined) leavePreviousRoom(deps, input.playerId, input.code) else null

    gameMode.joinPlayer(input.playerId, input.nickname)

    if (!alreadyJoined) {
        record.players.add(RoomPlayer(input.playerId, input.nickname))
        deps.roomRepository.save(record)
    }

    deps.roomRepository.setActiveRoomForPlayer(input.playerId, input.code)

    return JoinRoomResult(record = record, gameMode = gameMode, previousRoom = previousRoom)
}

private fun leavePreviousRoom(deps: RoomDeps, playerId: String, newCode: String): LeaveRoomResult? {
    val previousCode = deps.roomRepository.findActiveRoomCodeForPlayer(playerId) ?: return null
    if (previousCode == newCode) return null

    return try {
        leaveRoom(deps, LeaveRoomInput(code = previousCode, playerId = playerId))
    } catch (_: Exception) {
        // Previous room is already gone (e.g. it was already deleted/expired).
        null
    }
}
