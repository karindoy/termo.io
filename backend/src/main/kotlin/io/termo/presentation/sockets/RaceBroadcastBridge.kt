package io.termo.presentation.sockets

import io.termo.application.RoomDeps
import io.termo.application.gamemodes.PlayerRoundSnapshot
import io.termo.application.gamemodes.PlayerWordResolvedEvent
import io.termo.application.gamemodes.RaceConfigSnapshot
import io.termo.application.gamemodes.RaceEvents
import io.termo.application.gamemodes.RaceFinishedEvent
import io.termo.application.usecases.room.markRoomFinished
import io.termo.infrastructure.realtime.RaceRegistry
import io.termo.presentation.dto.toDto

class RaceBroadcastBridge(
    private val hub: RoomHub,
    private val registry: RaceRegistry,
    private val deps: RoomDeps,
    private val code: String,
    private val sink: DeferringEventSink,
) : RaceEvents {

    override fun onRaceStarted(config: RaceConfigSnapshot) =
        sink.emit { hub.broadcast(code, "race:started", config.toDto()) }

    override fun onPlayerWordStarted(snapshot: PlayerRoundSnapshot) =
        sink.emit { hub.broadcast(code, "player:word-started", snapshot.toDto()) }

    override fun onPlayerWordResolved(event: PlayerWordResolvedEvent) =
        sink.emit { hub.broadcast(code, "player:word-resolved", event.toDto()) }

    override fun onRaceFinished(event: RaceFinishedEvent) = sink.emit {
        hub.broadcast(code, "race:finished", event.toDto())
        registry.remove(code)
        markRoomFinished(deps, code)
    }
}
