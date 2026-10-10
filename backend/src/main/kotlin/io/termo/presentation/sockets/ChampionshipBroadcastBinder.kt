package io.termo.presentation.sockets

import io.quarkus.runtime.Startup
import io.termo.application.RoomDeps
import io.termo.infrastructure.realtime.ChampionshipRegistry
import jakarta.annotation.PostConstruct
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject

/** Wires per-room broadcast bridges onto every championship game mode at startup, mirroring the
 * previous `registry.on('register', ...)` hook without depending on the WebSocket endpoint's
 * connection lifecycle. `@Startup` forces eager instantiation so the hook is registered before
 * any room can be created. */
@Startup
@ApplicationScoped
class ChampionshipBroadcastBinder @Inject constructor(
    private val deps: RoomDeps,
    private val hub: RoomHub,
    private val registry: ChampionshipRegistry,
    private val sink: DeferringEventSink,
) {

    @PostConstruct
    fun bind() {
        registry.onRegister { code, mode ->
            mode.addEvents(ChampionshipBroadcastBridge(hub, registry, deps, code, sink))
        }
    }
}
