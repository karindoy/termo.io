package io.termo.presentation.sockets

import io.termo.domain.valueobjects.ROOM_CODE_PATTERN
import io.termo.domain.valueobjects.RoomSettingsInput
import io.vertx.core.json.JsonObject

// Boundary validation for inbound socket payloads, mirroring the previous zod schemas:
// never trust raw client JSON, but fail with a plain "invalid payload" message.
internal fun JsonObject.validRoomCode(): String? =
    getString("code")?.takeIf { ROOM_CODE_PATTERN.matches(it) }

internal fun JsonObject.validPlayerId(): String? =
    getString("playerId")?.takeIf { it.isNotEmpty() && it.length <= 64 }

internal fun JsonObject.validNickname(): String? =
    getString("nickname")?.takeIf { it.isNotEmpty() && it.length <= 24 }

internal fun JsonObject.validSessionSecret(): String? =
    getString("sessionSecret")?.takeIf { it.length in 1..64 }

internal fun JsonObject.validGuess(): String? =
    getString("guess")?.takeIf { it.length == 5 }

internal fun JsonObject.validSettings(): RoomSettingsInput? {
    val settings = try {
        getJsonObject("settings")
    } catch (_: ClassCastException) {
        null
    } ?: return null

    return try {
        RoomSettingsInput(
            wordCount = settings.getInteger("wordCount"),
            maxAttempts = settings.getInteger("maxAttempts"),
            timeLimitMs = settings.getLong("timeLimitMs"),
        )
    } catch (_: Exception) {
        null
    }
}
