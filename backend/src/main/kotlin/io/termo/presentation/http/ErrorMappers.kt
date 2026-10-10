package io.termo.presentation.http

import io.termo.domain.errors.AttemptsExceededError
import io.termo.domain.errors.DomainError
import io.termo.domain.errors.GameAlreadyFinishedError
import io.termo.domain.errors.InvalidGuessError
import io.termo.domain.errors.InvalidRoomSettingsError
import io.termo.domain.errors.InvalidWordError
import io.termo.domain.errors.RoomAlreadyStartedError
import io.termo.domain.errors.RoomFullError
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.errors.RoundAlreadyResolvedError
import io.termo.domain.errors.UnauthorizedHostActionError
import jakarta.validation.ConstraintViolationException
import jakarta.ws.rs.core.MediaType
import jakarta.ws.rs.core.Response
import jakarta.ws.rs.ext.ExceptionMapper
import jakarta.ws.rs.ext.Provider

/** Central translation of typed domain failures to HTTP status codes, so no resource repeats it. */
@Provider
class DomainExceptionMapper : ExceptionMapper<DomainError> {

    override fun toResponse(exception: DomainError): Response {
        val status = when (exception) {
            is RoomNotFoundError -> Response.Status.NOT_FOUND
            is UnauthorizedHostActionError -> Response.Status.FORBIDDEN
            is RoomAlreadyStartedError -> Response.Status.CONFLICT
            is RoomFullError -> Response.Status.CONFLICT
            is InvalidRoomSettingsError -> Response.Status.BAD_REQUEST
            is InvalidGuessError -> Response.Status.BAD_REQUEST
            is AttemptsExceededError -> Response.Status.CONFLICT
            is InvalidWordError -> Response.Status.BAD_REQUEST
            is RoundAlreadyResolvedError -> Response.Status.CONFLICT
            is GameAlreadyFinishedError -> Response.Status.CONFLICT
        }
        return Response.status(status)
            .entity(apiError(exception.message ?: "Erro inesperado"))
            .type(MediaType.APPLICATION_JSON)
            .build()
    }
}

@Provider
class ConstraintViolationExceptionMapper : ExceptionMapper<ConstraintViolationException> {

    override fun toResponse(exception: ConstraintViolationException): Response =
        Response.status(Response.Status.BAD_REQUEST)
            .entity(apiError("Dados inválidos"))
            .type(MediaType.APPLICATION_JSON)
            .build()
}
