package io.termo.domain.valueobjects

import java.security.SecureRandom

private const val ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
private const val ROOM_CODE_LENGTH = 8

/** Accepts only well-formed room codes (the alphabet deliberately excludes ambiguous characters). */
val ROOM_CODE_PATTERN = Regex("^[$ROOM_CODE_ALPHABET]{$ROOM_CODE_LENGTH}$")

private val SECURE_RANDOM = SecureRandom()

// The first character is forced to instanceTag (one symbol of ROOM_CODE_ALPHABET, unique
// per backend replica) so a reverse proxy can route a room's traffic — HTTP and WebSocket
// alike — to the same instance that owns its in-process game state, purely by reading the
// code, with no shared routing table needed.
fun generateRoomCode(instanceTag: String): String {
    val rest = StringBuilder(ROOM_CODE_LENGTH - 1)
    repeat(ROOM_CODE_LENGTH - 1) {
        val byte = SECURE_RANDOM.nextInt(256)
        rest.append(ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length])
    }
    return instanceTag + rest
}
