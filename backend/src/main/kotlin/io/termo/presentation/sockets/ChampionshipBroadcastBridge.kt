package io.termo.presentation.sockets

import io.termo.application.RoomDeps
import io.termo.application.gamemodes.ChampionshipEvents
import io.termo.application.gamemodes.GameFinishedEvent
import io.termo.application.gamemodes.RoundSnapshot
import io.termo.application.gamemodes.TieBreakStartedEvent
import io.termo.application.gamemodes.WordResolvedEvent
import io.termo.application.usecases.room.markRoomFinished
import io.termo.infrastructure.realtime.ChampionshipRegistry
import io.termo.presentation.dto.toDto

class ChampionshipBroadcastBridge(
    private val hub: RoomHub,
    private val registry: ChampionshipRegistry,
    private val deps: RoomDeps,
    private val code: String,
    private val sink: DeferringEventSink,
) : ChampionshipEvents {

    override fun onRoundStarted(snapshot: RoundSnapshot) =
        sink.emit { hub.broadcast(code, "round:started", snapshot.toDto()) }

    override fun onExtraAttempts(snapshot: RoundSnapshot) =
        sink.emit { hub.broadcast(code, "round:extra-attempts", snapshot.toDto()) }

    override fun onWordResolved(event: WordResolvedEvent) =
        sink.emit { hub.broadcast(code, "word:resolved", event.toDto()) }

    override fun onTieBreakStarted(event: TieBreakStartedEvent) =
        sink.emit { hub.broadcast(code, "tiebreak:started", event.toDto()) }

    override fun onGameFinished(event: GameFinishedEvent) = sink.emit {
        hub.broadcast(code, "game:finished", event.toDto())
        registry.remove(code)
        markRoomFinished(deps, code)
    }
}
