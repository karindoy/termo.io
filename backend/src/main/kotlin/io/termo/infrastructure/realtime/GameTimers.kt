package io.termo.infrastructure.realtime

import jakarta.annotation.PreDestroy
import jakarta.enterprise.context.ApplicationScoped
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.logging.Level
import java.util.logging.Logger

/** Central scheduler for every game/room timer (round timeouts, host-migration grace periods,
 * start/restart countdowns), so they share one managed, shutdown-aware thread pool. */
@ApplicationScoped
class GameTimers {

    private val logger = Logger.getLogger(GameTimers::class.java.name)

    private val scheduler = Executors.newScheduledThreadPool(2) { runnable ->
        Thread(runnable, "game-timer").apply { isDaemon = true }
    }

    fun schedule(delayMs: Long, action: () -> Unit): ScheduledFuture<*> {
        val delay = delayMs.coerceAtLeast(0)
        return scheduler.schedule(
            {
                runCatching(action).onFailure { logger.log(Level.SEVERE, "game timer task failed", it) }
            },
            delay,
            TimeUnit.MILLISECONDS,
        )
    }

    fun cancel(handle: ScheduledFuture<*>?) {
        handle?.cancel(false)
    }

    @PreDestroy
    fun shutdown() {
        scheduler.shutdownNow()
    }
}
