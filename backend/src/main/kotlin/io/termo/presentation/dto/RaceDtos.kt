package io.termo.presentation.dto

import io.termo.application.gamemodes.RaceConfigSnapshot
import io.termo.application.gamemodes.PlayerRoundSnapshot
import io.termo.application.gamemodes.PlayerWordResolvedEvent
import io.termo.application.gamemodes.RaceFinishedEvent
import io.termo.domain.entities.PlayerProgressSnapshot

data class RaceConfigDto(
    val wordCount: Int,
    val wordLength: Int,
    val timeLimitMs: Long,
)

data class PlayerProgressSnapshotDto(
    val playerId: String,
    val wordIndex: Int,
    val roundStartedAt: Long,
    val finished: Boolean,
    val won: Boolean,
)

data class RaceRoomStateDto(
    val wordCount: Int,
    val wordLength: Int,
    val timeLimitMs: Long,
    val players: List<RoomPlayerDto>,
    val progress: List<PlayerProgressSnapshotDto>,
    val attemptsByPlayer: Map<String, List<AttemptDto>>,
    val phase: String,
    val winnerId: String?,
)

data class PlayerRoundSnapshotDto(
    val playerId: String,
    val wordIndex: Int,
    val roundStartedAt: Long,
    val finished: Boolean,
)

data class PlayerWordResolvedDto(
    val playerId: String,
    val wordIndex: Int,
    val reason: String,
    val revealedWord: String,
    val hasNextWord: Boolean,
    val playerFinished: Boolean,
    val playerWon: Boolean,
    val gameFinished: Boolean,
    val winnerId: String?,
)

data class RaceFinishedDto(
    val winnerId: String?,
)

data class RaceGuessResultDto(
    val attempt: AttemptDto,
    val solved: Boolean,
    val winnerId: String?,
    val wordIndex: Int,
)

fun RaceConfigSnapshot.toDto(): RaceConfigDto =
    RaceConfigDto(wordCount = wordCount, wordLength = wordLength, timeLimitMs = timeLimitMs)

fun PlayerProgressSnapshot.toDto(): PlayerProgressSnapshotDto = PlayerProgressSnapshotDto(
    playerId = playerId,
    wordIndex = wordIndex,
    roundStartedAt = roundStartedAt,
    finished = finished,
    won = won,
)

fun PlayerRoundSnapshot.toDto(): PlayerRoundSnapshotDto = PlayerRoundSnapshotDto(
    playerId = playerId,
    wordIndex = wordIndex,
    roundStartedAt = roundStartedAt,
    finished = finished,
)

fun PlayerWordResolvedEvent.toDto(): PlayerWordResolvedDto = PlayerWordResolvedDto(
    playerId = playerId,
    wordIndex = wordIndex,
    reason = reason,
    revealedWord = revealedWord,
    hasNextWord = hasNextWord,
    playerFinished = playerFinished,
    playerWon = playerWon,
    gameFinished = gameFinished,
    winnerId = winnerId,
)

fun RaceFinishedEvent.toDto(): RaceFinishedDto = RaceFinishedDto(winnerId = winnerId)
