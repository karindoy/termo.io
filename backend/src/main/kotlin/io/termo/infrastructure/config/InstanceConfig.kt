package io.termo.infrastructure.config

import jakarta.inject.Singleton
import org.eclipse.microprofile.config.inject.ConfigProperty

@Singleton
class InstanceConfig {
    /** First character of every room code this instance mints — lets a reverse proxy route a
     * room's whole lifetime (HTTP and WebSocket) to the instance that owns its in-process state. */
    @field:ConfigProperty(name = "app.instance-tag", defaultValue = "A")
    lateinit var instanceTag: String
}
