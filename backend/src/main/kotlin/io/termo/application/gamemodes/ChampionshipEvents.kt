package io.termo.application.gamemodes

data class RoundSnapshot(
    val roomId: String,
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

data class WordResolvedEvent(
    val roomId: String,
    val roundSequence: Int,
    val wordIndex: Int,
    val isTieBreak: Boolean,
    val reason: String,
    val winnerId: String?,
    val revealedWord: String,
    val scores: Map<String, Int>,
    val gameStatus: String,
    val tieBreakCandidates: List<String>?,
    val finalWinnerIds: List<String>?,
)

data class TieBreakStartedEvent(
    val roomId: String,
    val candidateIds: List<String>,
    val snapshot: RoundSnapshot,
)

data class GameFinishedEvent(
    val roomId: String,
    val winnerIds: List<String>,
    val scores: Map<String, Int>,
)

/** Presentation-side observers attached to a [ChampionshipMode] instance once it is registered. */
interface ChampionshipEvents {
    fun onRoundStarted(snapshot: RoundSnapshot) {}

    fun onExtraAttempts(snapshot: RoundSnapshot) {}

    fun onWordResolved(event: WordResolvedEvent) {}

    fun onTieBreakStarted(event: TieBreakStartedEvent) {}

    fun onGameFinished(event: GameFinishedEvent) {}
}
