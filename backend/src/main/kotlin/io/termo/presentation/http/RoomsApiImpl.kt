package io.termo.presentation.http

import io.termo.application.RoomDeps
import io.termo.application.usecases.room.CreateRoomInput
import io.termo.application.usecases.room.StartGameInput
import io.termo.application.usecases.room.UpdateRoomSettingsInput
import io.termo.application.usecases.room.createRoom
import io.termo.application.usecases.room.listPublicRooms
import io.termo.application.usecases.room.startGame
import io.termo.application.usecases.room.updateRoomSettings
import io.termo.presentation.api.RoomsApi
import io.termo.presentation.api.model.CreateRoomRequest
import io.termo.presentation.api.model.StartGameRequest
import io.termo.presentation.api.model.UpdateRoomSettingsRequest
import jakarta.inject.Inject
import jakarta.inject.Singleton
import jakarta.ws.rs.core.MediaType
import jakarta.ws.rs.core.Response

/** Implements the OpenAPI-generated [RoomsApi] contract; all wire validation and shape come from
 * the generated interface/models — this class only orchestrates use cases and maps the domain. */
@Singleton
class RoomsApiImpl @Inject constructor(
    private val deps: RoomDeps,
) : RoomsApi {

    override fun createRoom(createRoomRequest: CreateRoomRequest): Response {
        val record = createRoom(
            deps,
            CreateRoomInput(
                hostId = createRoomRequest.hostId!!,
                nickname = createRoomRequest.nickname!!,
                mode = createRoomRequest.mode.toDomain(),
                isPublic = createRoomRequest.isPublic ?: true,
                settings = createRoomRequest.settings.toDomain(),
            ),
        )
        return Response.status(Response.Status.CREATED)
            .entity(record.toApiModel())
            .type(MediaType.APPLICATION_JSON)
            .build()
    }

    override fun listRooms(): Response =
        Response.ok(listPublicRooms(deps).map { it.toApiSummary() })
            .type(MediaType.APPLICATION_JSON)
            .build()

    override fun getRoom(code: String): Response {
        val record = deps.roomRepository.findByCode(code)
            ?: return notFound("Sala \"$code\" não encontrada")
        return Response.ok(record.toApiModel()).type(MediaType.APPLICATION_JSON).build()
    }

    override fun updateRoomSettings(code: String, updateRoomSettingsRequest: UpdateRoomSettingsRequest): Response {
        val playerId = updateRoomSettingsRequest.playerId!!
        if (!deps.sessionStore.verify(code, playerId, updateRoomSettingsRequest.sessionSecret)) {
            return unauthorized()
        }

        val record = updateRoomSettings(
            deps,
            UpdateRoomSettingsInput(
                code = code,
                playerId = playerId,
                settings = updateRoomSettingsRequest.settings.toDomain(),
            ),
        )
        return Response.ok(record.toApiModel()).type(MediaType.APPLICATION_JSON).build()
    }

    override fun startGame(code: String, startGameRequest: StartGameRequest): Response {
        val playerId = startGameRequest.playerId!!
        if (!deps.sessionStore.verify(code, playerId, startGameRequest.sessionSecret)) {
            return unauthorized()
        }

        val record = startGame(deps, StartGameInput(code = code, playerId = playerId))
        return Response.ok(record.toApiModel()).type(MediaType.APPLICATION_JSON).build()
    }

    private fun notFound(message: String): Response =
        Response.status(Response.Status.NOT_FOUND)
            .entity(apiError(message))
            .type(MediaType.APPLICATION_JSON)
            .build()

    private fun unauthorized(): Response =
        Response.status(Response.Status.UNAUTHORIZED)
            .entity(apiError("Sessão inválida — entre na sala novamente"))
            .type(MediaType.APPLICATION_JSON)
            .build()
}
