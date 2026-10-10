package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.domain.errors.RoomAlreadyStartedError
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.errors.UnauthorizedHostActionError
import io.termo.domain.repositories.RoomMode
import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomStatus
import io.termo.infrastructure.realtime.RoomLocks

data class StartGameInput(
    val code: String,
    val playerId: String,
)

fun startGame(deps: RoomDeps, input: StartGameInput): RoomRecord =
    RoomLocks.withLock(input.code) { startGameLocked(deps, input) }

private fun startGameLocked(deps: RoomDeps, input: StartGameInput): RoomRecord {
    val record = deps.roomRepository.findByCode(input.code)
        ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")
    if (record.hostId != input.playerId) {
        throw UnauthorizedHostActionError("Somente o host pode iniciar a partida")
    }
    if (record.status != RoomStatus.LOBBY) {
        throw RoomAlreadyStartedError("Sala \"${input.code}\" já foi iniciada")
    }

    when (record.mode) {
        RoomMode.CHAMPIONSHIP -> {
            val gameMode = deps.championshipRegistry.get(record.code)
                ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")
            gameMode.start()
        }

        RoomMode.RACE -> {
            val gameMode = deps.raceRegistry.get(record.code)
                ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")
            gameMode.start()
        }
    }

    record.status = RoomStatus.IN_PROGRESS
    deps.roomRepository.save(record)
    return record
}
