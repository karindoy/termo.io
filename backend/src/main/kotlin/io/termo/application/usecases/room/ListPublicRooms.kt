package io.termo.application.usecases.room

import io.termo.application.RoomDeps
import io.termo.domain.repositories.RoomRecord

fun listPublicRooms(deps: RoomDeps): List<RoomRecord> = deps.roomRepository.listPublicLobbies()
