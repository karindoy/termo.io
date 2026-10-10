package io.termo.presentation.http

import io.termo.presentation.api.HealthApi
import io.termo.presentation.api.model.HealthStatus
import jakarta.inject.Singleton
import jakarta.ws.rs.core.MediaType
import jakarta.ws.rs.core.Response

/** Implements the OpenAPI-generated [HealthApi] contract. */
@Singleton
class HealthApiImpl : HealthApi {

    override fun getHealth(): Response =
        Response.ok(HealthStatus().apply { status = "ok" })
            .type(MediaType.APPLICATION_JSON)
            .build()
}
