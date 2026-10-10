package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.repositories.RoomRecord
import io.termo.infrastructure.realtime.RoomLocks

data class MigrateHostInput(
    val code: String,
)

data class MigrateHostResult(
    val record: RoomRecord,
    val newHostId: String?,
)

fun migrateHost(deps: RoomDeps, input: MigrateHostInput): MigrateHostResult =
    RoomLocks.withLock(input.code) { migrateHostLocked(deps, input) }

private fun migrateHostLocked(deps: RoomDeps, input: MigrateHostInput): MigrateHostResult {
    val record = deps.roomRepository.findByCode(input.code)
        ?: throw RoomNotFoundError("Sala \"${input.code}\" não encontrada")

    val nextHost = record.players.firstOrNull { it.playerId != record.hostId }
        ?: return MigrateHostResult(record = record, newHostId = null)

    record.hostId = nextHost.playerId
    deps.roomRepository.save(record)
    return MigrateHostResult(record = record, newHostId = nextHost.playerId)
}
