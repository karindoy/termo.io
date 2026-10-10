package io.termo.domain.repositories

import com.fasterxml.jackson.annotation.JsonProperty
import io.termo.domain.valueobjects.RoomSettings

const val MAX_PLAYERS_PER_ROOM = 50

enum class RoomMode(val wire: String) {
    CHAMPIONSHIP("championship"),
    RACE("race"),
    ;

    companion object {
        fun fromWire(value: String): RoomMode? = entries.firstOrNull { it.wire == value }
    }
}

enum class RoomStatus(val wire: String) {
    LOBBY("lobby"),
    IN_PROGRESS("in-progress"),
    FINISHED("finished"),
}

data class RoomPlayer(
    val playerId: String,
    val nickname: String,
)

data class RoomRecord(
    val code: String,
    val mode: RoomMode,
    var hostId: String,
    val createdAt: Long,
    @param:JsonProperty("isPublic") @get:JsonProperty("isPublic") val isPublic: Boolean,
    var settings: RoomSettings,
    var status: RoomStatus,
    var players: MutableList<RoomPlayer>,
)

interface RoomRepository {
    fun create(record: RoomRecord)

    fun findByCode(code: String): RoomRecord?

    fun save(record: RoomRecord)

    fun delete(code: String)

    fun listPublicLobbies(): List<RoomRecord>

    /** Called once at boot to drop stale lobby entries this instance owned before restarting —
     * scoped by instanceTag so it never touches a sibling instance's live rooms. */
    fun clearPublicLobbies(instanceTag: String)

    /** Tracks which room a player currently occupies, independent of game mode, so joining a
     * new room can evict them from a previous one. */
    fun findActiveRoomCodeForPlayer(playerId: String): String?

    fun setActiveRoomForPlayer(playerId: String, code: String)

    fun clearActiveRoomForPlayer(playerId: String)
}
