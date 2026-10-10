package io.termo.presentation.sockets

import io.termo.infrastructure.realtime.GameTimers
import io.termo.presentation.dto.CountdownStartedDto
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ScheduledFuture

/** Broadcasts a synchronized countdown to a room, then runs `action` once it elapses, so all
 * clients see the same countdown before the game actually starts/restarts. Ignored if a
 * countdown is already running for this room code (guards double-clicking the host button). */
@ApplicationScoped
class RoomCountdown @Inject constructor(
    private val hub: RoomHub,
    private val timers: GameTimers,
) {

    private val pending = ConcurrentHashMap<String, ScheduledFuture<*>>()

    fun run(code: String, reason: String, action: () -> Unit) {
        if (pending.containsKey(code)) return

        hub.broadcast(code, "room:countdown:started", CountdownStartedDto(code, COUNTDOWN_SECONDS, reason))

        val handle = timers.schedule(COUNTDOWN_SECONDS * 1000L) {
            pending.remove(code)
            action()
        }
        pending[code] = handle
    }

    companion object {
        const val COUNTDOWN_SECONDS = 10
    }
}
