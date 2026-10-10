package io.termo.infrastructure.persistence.words

import io.termo.domain.entities.Word
import io.termo.domain.repositories.WordRepository
import io.termo.domain.valueobjects.normalizeWord
import jakarta.enterprise.context.ApplicationScoped
import java.util.concurrent.ThreadLocalRandom
import java.util.concurrent.atomic.AtomicInteger

private const val WORDLIST_RESOURCE = "/wordlist.txt"

/** Every word in the list is eligible to be both the secret word and a valid guess. */
@ApplicationScoped
class InMemoryWordRepository : WordRepository {

    private val words: List<String> = loadWords()
    private val normalizedWords: Set<String> = words.map { normalizeWord(it) }.toHashSet()

    // Opt-in test hook: unset in normal/prod use. When set, secret words cycle through
    // this list in order instead of being picked randomly, so e2e tests can know the
    // secret word in advance without touching game logic.
    private val fixedWords: List<String> = (System.getenv("E2E_FIXED_WORDS") ?: "")
        .split(',')
        .map { it.trim() }
        .filter { it.isNotEmpty() }

    private val fixedWordCursor = AtomicInteger(0)

    override fun getRandomWord(): Word {
        if (fixedWords.isNotEmpty()) {
            val value = fixedWords[fixedWordCursor.getAndIncrement() % fixedWords.size]
            return Word.create(value)
        }
        val value = words[ThreadLocalRandom.current().nextInt(words.size)]
        return Word.create(value)
    }

    override fun isValidGuess(value: String): Boolean = normalizedWords.contains(normalizeWord(value))

    override fun getWordAt(index: Int): Word = Word.create(words[index.mod(words.size)])

    override fun size(): Int = words.size

    private companion object {
        fun loadWords(): List<String> {
            val stream = InMemoryWordRepository::class.java.getResourceAsStream(WORDLIST_RESOURCE)
                ?: throw IllegalStateException("$WORDLIST_RESOURCE not found on the classpath")
            return stream.bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.map { it.trim() }.filter { it.isNotEmpty() }.toList()
            }
        }
    }
}
