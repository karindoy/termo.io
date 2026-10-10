package io.termo.application

import io.termo.domain.repositories.RoomRepository
import io.termo.domain.repositories.WordRepository
import io.termo.infrastructure.config.InstanceConfig
import io.termo.infrastructure.realtime.ChampionshipRegistry
import io.termo.infrastructure.realtime.GameTimers
import io.termo.infrastructure.realtime.HostMigrationTracker
import io.termo.infrastructure.realtime.PlayerSessionStore
import io.termo.infrastructure.realtime.RaceRegistry
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject

/** Shared composition root for every room use case, wire-compatible with the previous
 * `joinRoomDeps`/`restartRoomDeps` bags — one place that knows the concrete collaborators. */
@ApplicationScoped
class RoomDeps @Inject constructor(
    val roomRepository: RoomRepository,
    val wordRepository: WordRepository,
    val championshipRegistry: ChampionshipRegistry,
    val raceRegistry: RaceRegistry,
    val sessionStore: PlayerSessionStore,
    val hostMigrationTracker: HostMigrationTracker,
    val timers: GameTimers,
    config: InstanceConfig,
) {
    val instanceTag: String = config.instanceTag
}
