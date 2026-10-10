package io.termo.presentation.http

import jakarta.annotation.Priority
import jakarta.ws.rs.Priorities
import jakarta.ws.rs.container.ContainerRequestContext
import jakarta.ws.rs.container.ContainerRequestFilter
import jakarta.ws.rs.core.MediaType
import jakarta.ws.rs.core.Response
import jakarta.ws.rs.ext.Provider
import java.util.concurrent.ConcurrentHashMap

private const val WINDOW_MS = 60_000L

private const val GLOBAL_LIMIT = 100
private const val CREATE_ROOM_LIMIT = 10
private const val ROOM_LOOKUP_LIMIT = 20
private const val DAILY_GUESS_LIMIT = 60

private val ROOM_CODE_LOOKUP = Regex("^rooms/[^/]+$")
private val DAILY_GUESS = Regex("^daily/[^/]+/guess$")

/** In-memory, per-client fixed-window rate limiting mirroring the previous Fastify setup:
 * a global 100 req/min cap plus tighter buckets on room creation, room lookup and daily
 * guess submission. */
@Provider
@Priority(Priorities.AUTHENTICATION - 100)
class RateLimitFilter : ContainerRequestFilter {

    private class Counter(var windowStart: Long, var count: Int)

    private val counters = ConcurrentHashMap<String, Counter>()

    override fun filter(requestContext: ContainerRequestContext) {
        val method = requestContext.method
        val path = requestContext.uriInfo.path.trimStart('/')
        val limit = bucketLimit(method, path)

        val ip = clientIp(requestContext)
        if (isLimited("$method:$path:$limit:$ip", limit)) {
            requestContext.abortWith(
                Response.status(429)
                    .entity(apiError("Muitas requisições — tente novamente em instantes"))
                    .type(MediaType.APPLICATION_JSON)
                    .build(),
            )
        }
    }

    private fun bucketLimit(method: String, path: String): Int = when {
        method == "POST" && path == "rooms" -> CREATE_ROOM_LIMIT
        method == "GET" && ROOM_CODE_LOOKUP.matches(path) -> ROOM_LOOKUP_LIMIT
        method == "POST" && DAILY_GUESS.matches(path) -> DAILY_GUESS_LIMIT
        else -> GLOBAL_LIMIT
    }

    private fun isLimited(key: String, limit: Int): Boolean {
        val now = System.currentTimeMillis()
        val counter = counters.compute(key) { _, existing ->
            if (existing == null || now - existing.windowStart >= WINDOW_MS) {
                Counter(now, 1)
            } else {
                existing.count += 1
                existing
            }
        }!!
        return counter.count > limit
    }

    private fun clientIp(requestContext: ContainerRequestContext): String {
        requestContext.getHeaderString("X-Real-IP")?.let { return it }
        requestContext.getHeaderString("X-Forwarded-For")?.let { forwarded ->
            forwarded.substringBefore(',').trim().takeIf { it.isNotEmpty() }?.let { return it }
        }
        return "unknown"
    }
}
