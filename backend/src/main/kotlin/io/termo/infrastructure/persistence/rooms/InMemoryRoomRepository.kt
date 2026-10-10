package io.termo.infrastructure.persistence.rooms

import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomRepository

/** In-memory room store used by unit tests. Returns defensive copies so callers cannot
 * mutate stored state by accident. */
class InMemoryRoomRepository : RoomRepository {

    private val rooms = LinkedHashMap<String, RoomRecord>()
    private val activeRoomByPlayer = HashMap<String, String>()

    override fun create(record: RoomRecord) {
        rooms[record.code] = record.copy(players = record.players.mapTo(mutableListOf()) { it.copy() })
    }

    override fun findByCode(code: String): RoomRecord? =
        rooms[code]?.let { record -> record.copy(players = record.players.mapTo(mutableListOf()) { it.copy() }) }

    override fun save(record: RoomRecord) {
        rooms[record.code] = record.copy(players = record.players.mapTo(mutableListOf()) { it.copy() })
    }

    override fun delete(code: String) {
        rooms.remove(code)
    }

    override fun listPublicLobbies(): List<RoomRecord> =
        rooms.values
            .filter { it.isPublic && it.status == io.termo.domain.repositories.RoomStatus.LOBBY }
            .map { it.copy(players = it.players.mapTo(mutableListOf()) { player -> player.copy() }) }

    override fun clearPublicLobbies(instanceTag: String) {
        // No-op: an in-memory store has no stale cross-instance state to clean up.
    }

    override fun findActiveRoomCodeForPlayer(playerId: String): String? = activeRoomByPlayer[playerId]

    override fun setActiveRoomForPlayer(playerId: String, code: String) {
        activeRoomByPlayer[playerId] = code
    }

    override fun clearActiveRoomForPlayer(playerId: String) {
        activeRoomByPlayer.remove(playerId)
    }
}
