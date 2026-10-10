package io.termo.infrastructure.realtime

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// playerId is broadcast to every room member (and, for public rooms, to anyone
// browsing the lobby list) — it identifies a seat, not a credential. Privileged
// actions (host controls, guesses, leaving) must instead prove possession of the
// secret issued here at join time, which is never included in any room payload.
interface PlayerSessionStore {
    fun issue(code: String, playerId: String): String

    fun verify(code: String, playerId: String, secret: String?): Boolean

    fun clear(code: String)
}

/** In-memory implementation used by unit tests; production uses [RedisPlayerSessionStore]. */
class InMemoryPlayerSessionStore : PlayerSessionStore {
    private val secretsByRoom = ConcurrentHashMap<String, MutableMap<String, String>>()

    override fun issue(code: String, playerId: String): String {
        val secret = UUID.randomUUID().toString()
        secretsByRoom.computeIfAbsent(code) { ConcurrentHashMap() }[playerId] = secret
        return secret
    }

    override fun verify(code: String, playerId: String, secret: String?): Boolean {
        if (secret == null) return false
        return secretsByRoom[code]?.get(playerId) == secret
    }

    override fun clear(code: String) {
        secretsByRoom.remove(code)
    }
}
