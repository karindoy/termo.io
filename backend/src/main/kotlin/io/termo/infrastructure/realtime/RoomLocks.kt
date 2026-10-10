package io.termo.infrastructure.realtime

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

/** Serializes read-modify-write access to a room's state per room code. Without this,
 * concurrent handlers (e.g. several players joining at once) each read the same stale
 * RoomRecord, mutate their own copy, and save — the last save wins and silently drops
 * every other concurrent change. Reference-counted so locks are released from memory
 * once a room goes quiet. */
object RoomLocks {

    private class Entry {
        val lock = ReentrantLock()
        var references = 0
    }

    private val locks = ConcurrentHashMap<String, Entry>()

    fun <T> withLock(code: String, block: () -> T): T {
        val entry = locks.compute(code) { _, existing ->
            (existing ?: Entry()).also { it.references++ }
        }!!
        entry.lock.lock()
        try {
            return block()
        } finally {
            entry.lock.unlock()
            locks.compute(code) { _, existing ->
                if (existing !== entry) {
                    existing
                } else {
                    entry.references--
                    if (entry.references == 0) null else entry
                }
            }
        }
    }
}
