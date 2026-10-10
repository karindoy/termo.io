package io.termo.infrastructure.realtime

import io.quarkus.redis.datasource.RedisDataSource
import io.quarkus.redis.datasource.hash.HashCommands
import io.quarkus.redis.datasource.keys.KeyCommands
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject
import java.util.UUID

// Mirrors ROOM_TTL_SECONDS in RedisRoomRepository so a session never outlives
// the room record it authenticates against, and vice versa.
private const val SESSION_TTL_SECONDS = 6L * 60 * 60

private fun sessionKey(code: String): String = "session:$code"

@ApplicationScoped
class RedisPlayerSessionStore @Inject constructor(
    redis: RedisDataSource,
) : PlayerSessionStore {

    private val hashes: HashCommands<String, String, String> = redis.hash(String::class.java)
    private val keys: KeyCommands<String> = redis.key()

    override fun issue(code: String, playerId: String): String {
        val secret = UUID.randomUUID().toString()
        val key = sessionKey(code)
        hashes.hset(key, playerId, secret)
        keys.expire(key, SESSION_TTL_SECONDS)
        return secret
    }

    override fun verify(code: String, playerId: String, secret: String?): Boolean {
        if (secret == null) return false
        return hashes.hget(sessionKey(code), playerId) == secret
    }

    override fun clear(code: String) {
        keys.del(sessionKey(code))
    }
}
