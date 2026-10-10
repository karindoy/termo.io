package io.termo.infrastructure.persistence.words

import io.termo.domain.entities.Word
import io.termo.domain.repositories.WordRepository

// Determinism matters here, not unpredictability/security — the whole point is that every
// player, on any server instance, recomputes the exact same word(s) for a given date+mode
// with no shared "today's word" record to write or invalidate. FNV-1a is a small,
// well-known non-cryptographic hash, good enough for that.
private fun fnv1aHash(input: String): Long {
    var hash: Int = 0x811c9dc5.toInt()
    for (character in input) {
        hash = hash xor character.code
        hash *= 0x01000193
    }
    return hash.toLong() and 0xFFFFFFFFL
}

/** Picks `wordCount` distinct, date-seeded words from the dictionary for a given puzzle
 * date + mode. Same date + mode always resolves to the same words — no persistence. */
class DailyWordResolver(private val wordRepository: WordRepository) {

    fun resolve(date: String, mode: String, wordCount: Int): List<Word> {
        val size = wordRepository.size()
        val baseSeed = fnv1aHash("$date:$mode")

        val chosenIndices = HashSet<Int>()
        val words = mutableListOf<Word>()
        var step = 0
        while (words.size < wordCount) {
            val index = (fnv1aHash("$baseSeed:$step") % size).toInt()
            step += 1
            if (!chosenIndices.add(index)) continue
            words.add(wordRepository.getWordAt(index))
        }
        return words
    }
}
