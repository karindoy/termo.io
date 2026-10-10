package io.termo.presentation.sockets

import com.fasterxml.jackson.databind.ObjectMapper
import io.quarkus.websockets.next.WebSocketConnection
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject
import java.util.concurrent.ConcurrentHashMap

/** Tracks which connections belong to which room and fans messages out to them. Replaces the
 * Socket.IO rooms + Redis adapter: because the gateway pins a room's whole lifetime to one
 * instance, an in-process registry is sufficient and no cross-instance broadcast is needed. */
@ApplicationScoped
class RoomHub @Inject constructor(
    private val mapper: ObjectMapper,
) {

    private val members = ConcurrentHashMap<String, MutableSet<WebSocketConnection>>()
    private val roomByConnection = ConcurrentHashMap<String, String>()

    fun join(code: String, connection: WebSocketConnection) {
        leave(connection)
        members.computeIfAbsent(code) { ConcurrentHashMap.newKeySet<WebSocketConnection>() }.add(connection)
        roomByConnection[connection.id()] = code
    }

    fun leave(connection: WebSocketConnection) {
        val code = roomByConnection.remove(connection.id()) ?: return
        members[code]?.let { set ->
            set.remove(connection)
            if (set.isEmpty()) members.remove(code, set)
        }
    }

    fun roomOf(connection: WebSocketConnection): String? = roomByConnection[connection.id()]

    fun send(connection: WebSocketConnection, event: String, data: Any?) {
        deliver(connection, encode(event, data))
    }

    fun broadcast(code: String, event: String, data: Any?, exceptConnectionId: String? = null) {
        val json = encode(event, data)
        members[code]?.forEach { connection ->
            if (connection.id() != exceptConnectionId) deliver(connection, json)
        }
    }

    private fun deliver(connection: WebSocketConnection, json: String) {
        try {
            connection.sendTextAndAwait(json)
        } catch (_: Exception) {
            // The peer went away between the membership check and the send — nothing to do.
        }
    }

    private fun encode(event: String, data: Any?): String = mapper.writeValueAsString(WsMessage(event, data))
}
