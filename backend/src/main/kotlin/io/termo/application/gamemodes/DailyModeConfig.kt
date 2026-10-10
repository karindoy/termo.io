package io.termo.application.gamemodes

enum class DailyGameMode(val wire: String) {
    TERMO("termo"),
    DUETO("dueto"),
    QUARTETO("quarteto"),
    ;

    companion object {
        fun fromWire(value: String): DailyGameMode? = entries.firstOrNull { it.wire == value }
    }
}

data class DailyModeConfig(
    val wordCount: Int,
    val maxAttempts: Int,
)

// The three daily games are the same mechanic parameterized differently: Termo is the
// classic single-board daily, Dueto/Quarteto add more simultaneous boards under one
// shared attempt budget.
val DAILY_MODE_CONFIG: Map<DailyGameMode, DailyModeConfig> = mapOf(
    DailyGameMode.TERMO to DailyModeConfig(wordCount = 1, maxAttempts = 6),
    DailyGameMode.DUETO to DailyModeConfig(wordCount = 2, maxAttempts = 7),
    DailyGameMode.QUARTETO to DailyModeConfig(wordCount = 4, maxAttempts = 9),
)

val MAX_DAILY_ATTEMPTS: Int = DAILY_MODE_CONFIG.values.maxOf { it.maxAttempts }
