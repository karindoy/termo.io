package io.termo.domain.valueobjects

import java.text.Normalizer
import java.util.Locale

private val COMBINING_DIACRITICAL_MARKS = Regex("[\\u0300-\\u036f]")

/** Strips diacritics and uppercases a single letter, so `a` matches `ã` and `c` matches `ç`. */
fun normalizeLetter(letter: String): String =
    Normalizer.normalize(letter, Normalizer.Form.NFD)
        .replace(COMBINING_DIACRITICAL_MARKS, "")
        .uppercase(Locale.ROOT)

fun normalizeWord(word: String): String =
    word.map { normalizeLetter(it.toString()) }
        .joinToString("")
