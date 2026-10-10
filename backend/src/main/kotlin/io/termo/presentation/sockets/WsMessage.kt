package io.termo.presentation.sockets

import io.vertx.core.json.JsonObject

/** JSON envelope used by every client/server WebSocket message: `{ "event": "...", "data": {...} }`. */
data class WsMessage(
    val event: String,
    val data: Any?,
)

data class ParsedEnvelope(
    val event: String,
    val data: JsonObject,
)

object WsEnvelope {
    fun parse(message: String): ParsedEnvelope {
        val json = JsonObject(message)
        val event = json.getString("event") ?: throw IllegalArgumentException("missing event")
        val data = json.getJsonObject("data") ?: JsonObject()
        return ParsedEnvelope(event = event, data = data)
    }
}
