package io.termo.presentation.sockets

import io.quarkus.runtime.Startup
import io.termo.application.RoomDeps
import io.termo.infrastructure.realtime.RaceRegistry
import jakarta.annotation.PostConstruct
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject

/** Wires per-room broadcast bridges onto every race game mode at startup — see
 * [ChampionshipBroadcastBinder]. */
@Startup
@ApplicationScoped
class RaceBroadcastBinder @Inject constructor(
    private val deps: RoomDeps,
    private val hub: RoomHub,
    private val registry: RaceRegistry,
    private val sink: DeferringEventSink,
) {

    @PostConstruct
    fun bind() {
        registry.onRegister { code, mode ->
            mode.addEvents(RaceBroadcastBridge(hub, registry, deps, code, sink))
        }
    }
}
