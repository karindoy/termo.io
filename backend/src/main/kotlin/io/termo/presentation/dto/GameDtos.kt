package io.termo.presentation.dto

import com.fasterxml.jackson.annotation.JsonProperty
import io.termo.application.gamemodes.GameFinishedEvent
import io.termo.application.gamemodes.RoundSnapshot
import io.termo.application.gamemodes.TieBreakStartedEvent
import io.termo.application.gamemodes.WordResolvedEvent
import io.termo.domain.entities.Attempt

data class LetterFeedbackDto(
    val letter: String,
    val status: String,
)

data class AttemptDto(
    val playerId: String,
    val nickname: String,
    val guess: String,
    val feedback: List<LetterFeedbackDto>,
    val attemptNumber: Int,
    val createdAt: Long,
)

data class RoundSnapshotDto(
    val roundSequence: Int,
    val wordIndex: Int,
    val wordCount: Int,
    val wordLength: Int,
    val maxAttempts: Int,
    val timeLimitMs: Long,
    val roundStartedAt: Long,
    val phase: String,
    val tieBreakCandidates: List<String>?,
)

data class RoomStateDto(
    val roundSequence: Int,
    val wordIndex: Int,
    val wordCount: Int,
    val wordLength: Int,
    val maxAttempts: Int,
    val timeLimitMs: Long,
    val roundStartedAt: Long,
    val phase: String,
    val tieBreakCandidates: List<String>?,
    val players: List<RoomPlayerDto>,
    val scores: Map<String, Int>,
    val attempts: List<AttemptDto>,
    val solvedBy: String?,
)

data class WordResolvedDto(
    val roundSequence: Int,
    val wordIndex: Int,
    @param:JsonProperty("isTieBreak") @get:JsonProperty("isTieBreak") val isTieBreak: Boolean,
    val reason: String,
    val winnerId: String?,
    val revealedWord: String,
    val scores: Map<String, Int>,
    val gameStatus: String,
    val tieBreakCandidates: List<String>?,
    val finalWinnerIds: List<String>?,
)

data class TieBreakStartedDto(
    val roundSequence: Int,
    val wordIndex: Int,
    val wordCount: Int,
    val wordLength: Int,
    val maxAttempts: Int,
    val timeLimitMs: Long,
    val roundStartedAt: Long,
    val phase: String,
    val tieBreakCandidates: List<String>?,
    val candidateIds: List<String>,
)

data class GameFinishedDto(
    val winnerIds: List<String>,
    val scores: Map<String, Int>,
)

data class ChampionshipGuessResultDto(
    val attempt: AttemptDto,
    val solved: Boolean,
    val winnerId: String?,
    val roundSequence: Int,
)

fun Attempt.toDto(): AttemptDto = AttemptDto(
    playerId = playerId,
    nickname = nickname,
    guess = guess,
    feedback = feedback.map { LetterFeedbackDto(it.letter, it.status.wire) },
    attemptNumber = attemptNumber,
    createdAt = createdAt,
)

fun RoundSnapshot.toDto(): RoundSnapshotDto = RoundSnapshotDto(
    roundSequence = roundSequence,
    wordIndex = wordIndex,
    wordCount = wordCount,
    wordLength = wordLength,
    maxAttempts = maxAttempts,
    timeLimitMs = timeLimitMs,
    roundStartedAt = roundStartedAt,
    phase = phase,
    tieBreakCandidates = tieBreakCandidates,
)

fun WordResolvedEvent.toDto(): WordResolvedDto = WordResolvedDto(
    roundSequence = roundSequence,
    wordIndex = wordIndex,
    isTieBreak = isTieBreak,
    reason = reason,
    winnerId = winnerId,
    revealedWord = revealedWord,
    scores = scores,
    gameStatus = gameStatus,
    tieBreakCandidates = tieBreakCandidates,
    finalWinnerIds = finalWinnerIds,
)

fun TieBreakStartedEvent.toDto(): TieBreakStartedDto = TieBreakStartedDto(
    roundSequence = snapshot.roundSequence,
    wordIndex = snapshot.wordIndex,
    wordCount = snapshot.wordCount,
    wordLength = snapshot.wordLength,
    maxAttempts = snapshot.maxAttempts,
    timeLimitMs = snapshot.timeLimitMs,
    roundStartedAt = snapshot.roundStartedAt,
    phase = snapshot.phase,
    tieBreakCandidates = snapshot.tieBreakCandidates,
    candidateIds = candidateIds,
)

fun GameFinishedEvent.toDto(): GameFinishedDto = GameFinishedDto(
    winnerIds = winnerIds,
    scores = scores,
)

fun redactAttempt(attempt: AttemptDto): AttemptDto = attempt.copy(
    guess = "",
    feedback = attempt.feedback.map { it.copy(letter = "") },
)

fun redactAttemptsForViewer(attempts: List<AttemptDto>, viewerPlayerId: String): List<AttemptDto> =
    attempts.map { if (it.playerId == viewerPlayerId) it else redactAttempt(it) }
