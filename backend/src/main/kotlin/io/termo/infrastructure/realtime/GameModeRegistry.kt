package io.termo.infrastructure.realtime

import io.termo.application.gamemodes.ChampionshipMode
import io.termo.application.gamemodes.GameMode
import io.termo.application.gamemodes.RaceMode
import jakarta.enterprise.context.ApplicationScoped
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

// Emits 'register' on registration so socket broadcasting can be wired per-instance
// without the create-room use case depending on the WebSocket layer.
open class GameModeRegistry<T : GameMode> {

    private val instances = ConcurrentHashMap<String, T>()
    private val listeners = CopyOnWriteArrayList<(String, T) -> Unit>()

    fun onRegister(listener: (code: String, instance: T) -> Unit) {
        listeners.add(listener)
    }

    fun register(code: String, instance: T) {
        instances[code] = instance
        listeners.forEach { it(code, instance) }
    }

    fun get(code: String): T? = instances[code]

    fun remove(code: String) {
        instances.remove(code)
    }
}

@ApplicationScoped
class ChampionshipRegistry : GameModeRegistry<ChampionshipMode>()

@ApplicationScoped
class RaceRegistry : GameModeRegistry<RaceMode>()
