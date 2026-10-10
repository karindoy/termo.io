package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.application.gamemodes.ChampionshipMode
import io.termo.application.gamemodes.GameMode
import io.termo.application.gamemodes.RaceMode
import io.termo.domain.entities.GameOptions
import io.termo.domain.entities.RaceGameOptions
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.errors.UnauthorizedHostActionError
import io.termo.domain.repositories.RoomMode
import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomStatus
import io.termo.infrastructure.realtime.RoomLocks

data class RestartRoomInput(
    val code: String,
    val playerId: String,
)

data class RestartRoomResult(
    val record: RoomRecord,
    val gameMode: GameMode,
)

fun restartRoom(deps: RoomDeps, input: RestartRoomInput): RestartRoomResult =
    RoomLocks.withLock(input.code) { restartRoomLocked(deps, input) }

private fun restartRoomLocked(deps: RoomDeps, input: RestartRoomInput): RestartRoomResult {
    val record = deps.roomRepository.findByCode(input.code)
        ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")
    if (record.hostId != input.playerId) {
        throw UnauthorizedHostActionError("Somente o host pode reiniciar a partida")
    }

    val gameMode: GameMode = when (record.mode) {
        RoomMode.CHAMPIONSHIP -> {
            val mode = ChampionshipMode(
                roomId = record.code,
                wordRepository = deps.wordRepository,
                timers = deps.timers,
                options = GameOptions(
                    wordCount = record.settings.wordCount,
                    maxAttempts = record.settings.maxAttempts,
                    timeLimitMs = record.settings.timeLimitMs,
                    tieBreakMaxAttempts = ChampionshipMode.DEFAULT_TIE_BREAK_MAX_ATTEMPTS,
                    tieBreakTimeLimitMs = ChampionshipMode.DEFAULT_TIE_BREAK_TIME_LIMIT_MS,
                ),
            )
            record.players.forEach { mode.joinPlayer(it.playerId, it.nickname) }
            deps.championshipRegistry.register(record.code, mode)
            mode.start()
            mode
        }

        RoomMode.RACE -> {
            val mode = RaceMode(
                roomId = record.code,
                wordRepository = deps.wordRepository,
                timers = deps.timers,
                options = RaceGameOptions(
                    wordCount = record.settings.wordCount,
                    timeLimitMs = record.settings.timeLimitMs,
                ),
            )
            record.players.forEach { mode.joinPlayer(it.playerId, it.nickname) }
            deps.raceRegistry.register(record.code, mode)
            mode.start()
            mode
        }
    }

    record.status = RoomStatus.IN_PROGRESS
    deps.roomRepository.save(record)
    return RestartRoomResult(record = record, gameMode = gameMode)
}
