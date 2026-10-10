package io.termo.application.gamemodes

data class RaceConfigSnapshot(
    val roomId: String,
    val wordCount: Int,
    val wordLength: Int,
    val timeLimitMs: Long,
)

data class PlayerRoundSnapshot(
    val roomId: String,
    val playerId: String,
    val wordIndex: Int,
    val roundStartedAt: Long,
    val finished: Boolean,
)

data class PlayerWordResolvedEvent(
    val roomId: String,
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

data class RaceFinishedEvent(
    val roomId: String,
    val winnerId: String?,
)

/** Presentation-side observers attached to a [RaceMode] instance once it is registered. */
interface RaceEvents {
    fun onRaceStarted(config: RaceConfigSnapshot) {}

    fun onPlayerWordStarted(snapshot: PlayerRoundSnapshot) {}

    fun onPlayerWordResolved(event: PlayerWordResolvedEvent) {}

    fun onRaceFinished(event: RaceFinishedEvent) {}
}
