package io.termo.presentation.sockets

import jakarta.enterprise.context.ApplicationScoped

/** Defers event broadcasts queued during a guess submission until the matching `guess:result`
 * has been sent. The game mode resolves the round (and emits round/word events) synchronously
 * *before* the handler can emit `guess:result`; without deferral a client's round-transition
 * handler would run first and discard the very guess that won the round, so the winning tile
 * never renders. Deferring only the broadcast keeps this a presentation-layer concern.
 *
 * Application-scoped so every bridge and the socket endpoint that flushes the queue share one
 * instance; the state itself is thread-local, so concurrent rooms/handlers never interfere. */
@ApplicationScoped
class DeferringEventSink {

    private val depth = ThreadLocal.withInitial { 0 }
    private val queue = ThreadLocal.withInitial { mutableListOf<() -> Unit>() }

    fun emit(action: () -> Unit) {
        if (depth.get() > 0) queue.get().add(action) else action()
    }

    fun begin() {
        depth.set(depth.get() + 1)
    }

    fun end() {
        val next = depth.get() - 1
        depth.set(next)
        if (next <= 0) {
            val pending = queue.get().toList()
            depth.remove()
            queue.remove()
            pending.forEach { it() }
        }
    }
}
