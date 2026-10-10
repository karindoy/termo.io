package io.termo.domain.valueobjects

import java.time.Clock
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

private val PUZZLE_TIMEZONE = ZoneId.of("America/Sao_Paulo")
private val PUZZLE_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd")

/** Calendar date (YYYY-MM-DD) in a fixed timezone, so the daily puzzle rolls over at the
 * same instant for every player regardless of where they are. */
fun currentPuzzleDate(clock: Clock = Clock.systemUTC()): String =
    ZonedDateTime.now(clock.withZone(PUZZLE_TIMEZONE)).format(PUZZLE_DATE_FORMATTER)
