package io.termo.infrastructure.persistence.redis

import com.fasterxml.jackson.databind.ObjectMapper
import io.quarkus.redis.datasource.RedisDataSource
import io.quarkus.redis.datasource.keys.KeyCommands
import io.quarkus.redis.datasource.set.SetCommands
import io.quarkus.redis.datasource.value.SetArgs
import io.quarkus.redis.datasource.value.ValueCommands
import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomRepository
import io.termo.domain.repositories.RoomStatus
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject

private const val ROOM_TTL_SECONDS = 6L * 60 * 60
private const val PUBLIC_LOBBIES_KEY = "rooms:public-lobbies"

private fun roomKey(code: String): String = "room:$code"

private fun playerRoomKey(playerId: String): String = "player-room:$playerId"

@ApplicationScoped
class RedisRoomRepository @Inject constructor(
    redis: RedisDataSource,
    private val mapper: ObjectMapper,
) : RoomRepository {

    private val values: ValueCommands<String, String> = redis.value(String::class.java)
    private val keys: KeyCommands<String> = redis.key()
    private val sets: SetCommands<String, String> = redis.set(String::class.java)

    override fun create(record: RoomRecord) {
        values.setex(roomKey(record.code), ROOM_TTL_SECONDS, encode(record))
        syncPublicLobbyMembership(record)
    }

    override fun findByCode(code: String): RoomRecord? =
        values.get(roomKey(code))?.let { decode(it) }

    override fun save(record: RoomRecord) {
        values.set(roomKey(record.code), encode(record), SetArgs().keepttl())
        syncPublicLobbyMembership(record)
    }

    override fun delete(code: String) {
        keys.del(roomKey(code))
        sets.srem(PUBLIC_LOBBIES_KEY, code)
    }

    override fun findActiveRoomCodeForPlayer(playerId: String): String? =
        values.get(playerRoomKey(playerId))

    override fun setActiveRoomForPlayer(playerId: String, code: String) {
        values.setex(playerRoomKey(playerId), ROOM_TTL_SECONDS, code)
    }

    override fun clearActiveRoomForPlayer(playerId: String) {
        keys.del(playerRoomKey(playerId))
    }

    override fun clearPublicLobbies(instanceTag: String) {
        val codes = sets.smembers(PUBLIC_LOBBIES_KEY)
        val ownCodes = codes.filter { it.startsWith(instanceTag) }
        if (ownCodes.isNotEmpty()) {
            keys.del(*ownCodes.map { roomKey(it) }.toTypedArray())
            sets.srem(PUBLIC_LOBBIES_KEY, *ownCodes.toTypedArray())
        }
    }

    override fun listPublicLobbies(): List<RoomRecord> {
        val codes = sets.smembers(PUBLIC_LOBBIES_KEY)
        val records = mutableListOf<RoomRecord>()

        for (code in codes) {
            val record = findByCode(code)
            if (record != null && record.isPublic && record.status == RoomStatus.LOBBY) {
                records.add(record)
            } else {
                sets.srem(PUBLIC_LOBBIES_KEY, code)
            }
        }

        return records
    }

    private fun syncPublicLobbyMembership(record: RoomRecord) {
        if (record.isPublic && record.status == RoomStatus.LOBBY) {
            sets.sadd(PUBLIC_LOBBIES_KEY, record.code)
        } else {
            sets.srem(PUBLIC_LOBBIES_KEY, record.code)
        }
    }

    private fun encode(record: RoomRecord): String = mapper.writeValueAsString(record)

    private fun decode(raw: String): RoomRecord = mapper.readValue(raw, RoomRecord::class.java)
}
