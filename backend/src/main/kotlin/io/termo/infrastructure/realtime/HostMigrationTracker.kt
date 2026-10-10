package io.termo.infrastructure.realtime

import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ScheduledFuture

/** Gives a disconnected host a short grace period to reconnect before the host role is
 * migrated to another player. */
@ApplicationScoped
class HostMigrationTracker @Inject constructor(
    private val timers: GameTimers,
) {

    private val pending = ConcurrentHashMap<String, ScheduledFuture<*>>()

    fun onHostDisconnected(code: String, onLapse: () -> Unit) {
        cancel(code)
        val handle = timers.schedule(GRACE_PERIOD_MS) {
            pending.remove(code)
            onLapse()
        }
        pending[code] = handle
    }

    fun cancel(code: String) {
        pending.remove(code)?.let { timers.cancel(it) }
    }

    fun isPending(code: String): Boolean = pending.containsKey(code)

    companion object {
        const val GRACE_PERIOD_MS = 30 * 1000L
    }
}
