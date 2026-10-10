package io.termo.domain.valueobjects

import io.termo.domain.errors.InvalidRoomSettingsError

data class RoomSettings(
    val wordCount: Int,
    val maxAttempts: Int,
    val timeLimitMs: Long,
)

/** A partial override used when creating or updating room settings. */
data class RoomSettingsInput(
    val wordCount: Int? = null,
    val maxAttempts: Int? = null,
    val timeLimitMs: Long? = null,
)

private val DEFAULT_SETTINGS = RoomSettings(wordCount = 5, maxAttempts = 6, timeLimitMs = 5 * 60 * 1000L)

private const val MIN_WORD_COUNT = 1
private const val MAX_WORD_COUNT = 15
private const val MIN_MAX_ATTEMPTS = 1
private const val MAX_MAX_ATTEMPTS = 10
private const val MIN_TIME_LIMIT_MS = 30_000L
private const val MAX_TIME_LIMIT_MS = 10 * 60 * 1000L

fun createRoomSettings(input: RoomSettingsInput = RoomSettingsInput()): RoomSettings {
    val settings = RoomSettings(
        wordCount = input.wordCount ?: DEFAULT_SETTINGS.wordCount,
        maxAttempts = input.maxAttempts ?: DEFAULT_SETTINGS.maxAttempts,
        timeLimitMs = input.timeLimitMs ?: DEFAULT_SETTINGS.timeLimitMs,
    )

    if (settings.wordCount !in MIN_WORD_COUNT..MAX_WORD_COUNT) {
        throw InvalidRoomSettingsError("\"wordCount\" deve estar entre $MIN_WORD_COUNT e $MAX_WORD_COUNT")
    }
    if (settings.maxAttempts !in MIN_MAX_ATTEMPTS..MAX_MAX_ATTEMPTS) {
        throw InvalidRoomSettingsError("\"maxAttempts\" deve estar entre $MIN_MAX_ATTEMPTS e $MAX_MAX_ATTEMPTS")
    }
    if (settings.timeLimitMs !in MIN_TIME_LIMIT_MS..MAX_TIME_LIMIT_MS) {
        throw InvalidRoomSettingsError("\"timeLimitMs\" deve estar entre $MIN_TIME_LIMIT_MS e $MAX_TIME_LIMIT_MS")
    }

    return settings
}

fun mergeRoomSettings(base: RoomSettings, override: RoomSettingsInput): RoomSettings =
    createRoomSettings(
        RoomSettingsInput(
            wordCount = override.wordCount ?: base.wordCount,
            maxAttempts = override.maxAttempts ?: base.maxAttempts,
            timeLimitMs = override.timeLimitMs ?: base.timeLimitMs,
        ),
    )
