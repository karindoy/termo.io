package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.domain.repositories.RoomRecord
import io.termo.domain.repositories.RoomStatus
import io.termo.infrastructure.realtime.RoomLocks

fun markRoomFinished(deps: RoomDeps, code: String): RoomRecord? =
    RoomLocks.withLock(code) {
        val record = deps.roomRepository.findByCode(code) ?: return@withLock null
        record.status = RoomStatus.FINISHED
        deps.roomRepository.save(record)
        record
    }
