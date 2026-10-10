package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.application.gamemodes.ChampionshipMode
import io.termo.application.gamemodes.RaceMode
import io.termo.domain.entities.GameOptions
import io.termo.domain.entities.RaceGameOptions
import io.termo.domain.repositories.RoomMode
import io.termo.domain.repositories.RoomPlayer
import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomRepository
import io.termo.domain.repositories.RoomStatus
import io.termo.domain.valueobjects.RoomSettingsInput
import io.termo.domain.valueobjects.createRoomSettings
import io.termo.domain.valueobjects.generateRoomCode

private const val CODE_GENERATION_ATTEMPTS = 5

data class CreateRoomInput(
    val hostId: String,
    val nickname: String,
    val mode: RoomMode,
    val isPublic: Boolean = true,
    val settings: RoomSettingsInput = RoomSettingsInput(),
)

fun createRoom(deps: RoomDeps, input: CreateRoomInput): RoomRecord {
    val code = generateUniqueRoomCode(deps.roomRepository, deps.instanceTag)
    val settings = createRoomSettings(input.settings)

    // The game only starts once the host calls start-game; here we just stand up the room
    // shell so players can join the lobby and see each other.
    when (input.mode) {
        RoomMode.CHAMPIONSHIP -> {
            val gameMode = ChampionshipMode(
                roomId = code,
                wordRepository = deps.wordRepository,
                timers = deps.timers,
                options = GameOptions(
                    wordCount = settings.wordCount,
                    maxAttempts = settings.maxAttempts,
                    timeLimitMs = settings.timeLimitMs,
                    tieBreakMaxAttempts = ChampionshipMode.DEFAULT_TIE_BREAK_MAX_ATTEMPTS,
                    tieBreakTimeLimitMs = ChampionshipMode.DEFAULT_TIE_BREAK_TIME_LIMIT_MS,
                ),
            )
            gameMode.joinPlayer(input.hostId, input.nickname)
            deps.championshipRegistry.register(code, gameMode)
        }

        RoomMode.RACE -> {
            val gameMode = RaceMode(
                roomId = code,
                wordRepository = deps.wordRepository,
                timers = deps.timers,
                options = RaceGameOptions(
                    wordCount = settings.wordCount,
                    timeLimitMs = settings.timeLimitMs,
                ),
            )
            gameMode.joinPlayer(input.hostId, input.nickname)
            deps.raceRegistry.register(code, gameMode)
        }
    }

    val record = RoomRecord(
        code = code,
        mode = input.mode,
        hostId = input.hostId,
        createdAt = System.currentTimeMillis(),
        isPublic = input.isPublic,
        settings = settings,
        status = RoomStatus.LOBBY,
        players = mutableListOf(RoomPlayer(input.hostId, input.nickname)),
    )

    deps.roomRepository.create(record)
    deps.roomRepository.setActiveRoomForPlayer(input.hostId, code)
    return record
}

private fun generateUniqueRoomCode(roomRepository: RoomRepository, instanceTag: String): String {
    repeat(CODE_GENERATION_ATTEMPTS) {
        val code = generateRoomCode(instanceTag)
        if (roomRepository.findByCode(code) == null) return code
    }
    throw IllegalStateException("Não foi possível gerar um código de sala único")
}
