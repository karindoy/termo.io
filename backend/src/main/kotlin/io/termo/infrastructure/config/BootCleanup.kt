package io.termo.infrastructure.config

import io.quarkus.runtime.StartupEvent
import io.termo.application.RoomDeps
import jakarta.enterprise.context.ApplicationScoped
import jakarta.enterprise.event.Observes
import jakarta.inject.Inject

/** On boot, drop this instance's own stale public-lobby entries — scoped by instanceTag so a
 * restart never wipes a sibling instance's live rooms in the shared Redis. */
@ApplicationScoped
class BootCleanup @Inject constructor(
    private val deps: RoomDeps,
) {
    fun onStart(@Observes event: StartupEvent) {
        deps.roomRepository.clearPublicLobbies(deps.instanceTag)
    }
}
