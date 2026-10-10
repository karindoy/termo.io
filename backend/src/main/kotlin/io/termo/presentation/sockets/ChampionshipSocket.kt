package io.termo.presentation.sockets

import io.quarkus.websockets.next.OnClose
import io.quarkus.websockets.next.OnTextMessage
import io.quarkus.websockets.next.WebSocket
import io.quarkus.websockets.next.WebSocketConnection
import io.termo.application.RoomDeps
import io.termo.application.gamemodes.ChampionshipMode
import io.termo.application.usecases.SubmitGuessInput
import io.termo.application.usecases.room.JoinRoomInput
import io.termo.application.usecases.room.LeaveRoomInput
import io.termo.application.usecases.room.MigrateHostInput
import io.termo.application.usecases.room.RestartRoomInput
import io.termo.application.usecases.room.StartGameInput
import io.termo.application.usecases.room.UpdateRoomSettingsInput
import io.termo.application.usecases.room.joinRoom
import io.termo.application.usecases.room.leaveRoom
import io.termo.application.usecases.room.migrateHost
import io.termo.application.usecases.room.restartRoom
import io.termo.application.usecases.room.startGame
import io.termo.application.usecases.room.updateRoomSettings
import io.termo.application.usecases.submitGuess
import io.termo.domain.errors.RoomNotFoundError
import io.termo.domain.repositories.RoomStatus
import io.termo.infrastructure.realtime.ChampionshipRegistry
import io.termo.presentation.dto.ChampionshipGuessResultDto
import io.termo.presentation.dto.ErrorDto
import io.termo.presentation.dto.HostMigratedDto
import io.termo.presentation.dto.RoomPlayerDto
import io.termo.presentation.dto.RoomSessionDto
import io.termo.presentation.dto.RoomStateDto
import io.termo.presentation.dto.redactAttempt
import io.termo.presentation.dto.redactAttemptsForViewer
import io.termo.presentation.dto.toDto
import io.vertx.core.json.JsonObject
import java.util.concurrent.ConcurrentHashMap

@WebSocket(path = "/ws/championship")
class ChampionshipSocket(
    private val deps: RoomDeps,
    private val hub: RoomHub,
    private val registry: ChampionshipRegistry,
    private val countdown: RoomCountdown,
    private val sink: DeferringEventSink,
) {

    private class SessionState(val code: String, val playerId: String)

    private val sessions = ConcurrentHashMap<String, SessionState>()

    @OnTextMessage
    fun onText(message: String, connection: WebSocketConnection) {
        val envelope = runCatching { WsEnvelope.parse(message) }.getOrNull() ?: return
        when (envelope.event) {
            "room:join" -> handleJoin(connection, envelope.data)
            "room:leave" -> handleLeave(connection, envelope.data)
            "room:settings:update" -> handleUpdateSettings(connection, envelope.data)
            "room:start" -> handleStart(connection, envelope.data)
            "room:restart" -> handleRestart(connection, envelope.data)
            "guess:submit" -> handleGuess(connection, envelope.data)
        }
    }

    @OnClose
    fun onClose(connection: WebSocketConnection) {
        handleDisconnect(connection)
    }

    private fun handleJoin(connection: WebSocketConnection, data: JsonObject) {
        val code = data.validRoomCode()
        val playerId = data.validPlayerId()
        val nickname = data.validNickname()
        if (code == null || playerId == null || nickname == null) {
            sendError(connection, "room:error", "Payload de entrada inválido")
            return
        }

        val result = try {
            joinRoom(deps, JoinRoomInput(code, playerId, nickname))
        } catch (error: RoomNotFoundError) {
            sendError(connection, "room:error", error.message ?: "Sala não encontrada", "ROOM_NOT_FOUND")
            return
        } catch (error: Exception) {
            sendError(connection, "room:error", error.message ?: "Erro desconhecido")
            return
        }

        val record = result.record
        val gameMode = result.gameMode as ChampionshipMode

        // Leave any previous room's membership before re-broadcasting to it, so the joining
        // connection doesn't receive its own departure update.
        hub.join(code, connection)

        result.previousRoom?.let { previous ->
            previous.record?.let { previousRecord ->
                hub.broadcast(previous.code, "lobby:state", previousRecord.toDto())
                previous.hostMigratedTo?.let { hostId ->
                    deps.hostMigrationTracker.cancel(previous.code)
                    hub.broadcast(previous.code, "host:migrated", HostMigratedDto(previous.code, hostId))
                }
            }
        }

        sessions[connection.id()] = SessionState(code, playerId)
        if (record.hostId == playerId) {
            deps.hostMigrationTracker.cancel(code)
        }

        val sessionSecret = deps.sessionStore.issue(code, playerId)
        hub.send(connection, "room:session", RoomSessionDto(sessionSecret))

        if (record.status == RoomStatus.LOBBY) {
            hub.broadcast(code, "lobby:state", record.toDto())
            return
        }

        val room = gameMode.getRoom()
        val game = gameMode.getGame()
        hub.send(connection, "room:state", buildRoomState(gameMode, game, room, playerId))
        hub.broadcast(code, "room:players", room.players.values.map { RoomPlayerDto(it.playerId, it.nickname) })
    }

    private fun handleLeave(connection: WebSocketConnection, data: JsonObject) {
        val code = data.validRoomCode()
        val playerId = data.validPlayerId()
        val sessionSecret = data.validSessionSecret()
        if (code == null || playerId == null) {
            sendError(connection, "room:error", "Payload de saída inválido")
            return
        }
        if (!deps.sessionStore.verify(code, playerId, sessionSecret)) {
            sendError(connection, "room:error", "Sessão inválida — entre na sala novamente")
            return
        }

        try {
            val result = leaveRoom(deps, LeaveRoomInput(code, playerId))
            hub.leave(connection)
            result.record?.let { record ->
                hub.broadcast(code, "lobby:state", record.toDto())
                result.hostMigratedTo?.let { hostId ->
                    deps.hostMigrationTracker.cancel(code)
                    hub.broadcast(code, "host:migrated", HostMigratedDto(code, hostId))
                }
            }
        } catch (error: Exception) {
            sendError(connection, "room:error", error.message ?: "Erro desconhecido")
        }
    }

    private fun handleUpdateSettings(connection: WebSocketConnection, data: JsonObject) {
        val code = data.validRoomCode()
        val playerId = data.validPlayerId()
        val sessionSecret = data.validSessionSecret()
        val settings = data.validSettings()
        if (code == null || playerId == null || settings == null) {
            sendError(connection, "room:error", "Configurações inválidas")
            return
        }
        if (!deps.sessionStore.verify(code, playerId, sessionSecret)) {
            sendError(connection, "room:error", "Sessão inválida — entre na sala novamente")
            return
        }

        try {
            val record = updateRoomSettings(deps, UpdateRoomSettingsInput(code, playerId, settings))
            hub.broadcast(code, "lobby:state", record.toDto())
        } catch (error: Exception) {
            sendError(connection, "room:error", error.message ?: "Erro desconhecido")
        }
    }

    private fun handleStart(connection: WebSocketConnection, data: JsonObject) {
        val code = data.validRoomCode()
        val playerId = data.validPlayerId()
        val sessionSecret = data.validSessionSecret()
        if (code == null || playerId == null) {
            sendError(connection, "room:error", "Payload de início inválido")
            return
        }
        if (!deps.sessionStore.verify(code, playerId, sessionSecret)) {
            sendError(connection, "room:error", "Sessão inválida — entre na sala novamente")
            return
        }

        val record = deps.roomRepository.findByCode(code)
        if (record == null) {
            sendError(connection, "room:error", "Sala \"$code\" não encontrada")
            return
        }
        if (record.hostId != playerId) {
            sendError(connection, "room:error", "Somente o host pode iniciar a partida")
            return
        }

        countdown.run(code, "start") {
            try {
                val startedRecord = startGame(deps, StartGameInput(code, playerId))
                hub.broadcast(code, "game:start", startedRecord.toDto())
            } catch (error: Exception) {
                sendError(connection, "room:error", error.message ?: "Erro desconhecido")
            }
        }
    }

    private fun handleRestart(connection: WebSocketConnection, data: JsonObject) {
        val code = data.validRoomCode()
        val playerId = data.validPlayerId()
        if (code == null || playerId == null) {
            sendError(connection, "room:error", "Payload de reinício inválido")
            return
        }

        val record = deps.roomRepository.findByCode(code)
        if (record == null) {
            sendError(connection, "room:error", "Sala \"$code\" não encontrada")
            return
        }
        if (record.hostId != playerId) {
            sendError(connection, "room:error", "Somente o host pode reiniciar a partida")
            return
        }

        countdown.run(code, "restart") {
            try {
                val result = restartRoom(deps, RestartRoomInput(code, playerId))
                val championshipMode = result.gameMode as ChampionshipMode
                val room = championshipMode.getRoom()
                val game = championshipMode.getGame()
                hub.broadcast(
                    code,
                    "room:state",
                    buildRoomState(championshipMode, game, room, playerId, attempts = emptyList(), solvedBy = null),
                )
            } catch (error: Exception) {
                sendError(connection, "room:error", error.message ?: "Erro desconhecido")
            }
        }
    }

    private fun handleGuess(connection: WebSocketConnection, data: JsonObject) {
        val code = data.validRoomCode()
        val playerId = data.validPlayerId()
        val nickname = data.validNickname()
        val guess = data.validGuess()
        val sessionSecret = data.validSessionSecret()
        if (code == null || playerId == null || nickname == null || guess == null) {
            sendError(connection, "guess:error", "Palpite inválido")
            return
        }
        if (!deps.sessionStore.verify(code, playerId, sessionSecret)) {
            sendError(connection, "guess:error", "Sessão inválida — entre na sala novamente")
            return
        }

        val gameMode = registry.get(code)
        if (gameMode == null) {
            sendError(connection, "guess:error", "Sala \"$code\" não encontrada")
            return
        }

        val roundSequence = gameMode.getGame().roundSequenceNumber

        sink.begin()
        val result = try {
            submitGuess(gameMode, SubmitGuessInput(playerId, nickname, guess))
        } catch (error: Exception) {
            sink.end()
            sendError(connection, "guess:error", error.message ?: "Erro desconhecido")
            return
        }

        hub.send(
            connection,
            "guess:result",
            ChampionshipGuessResultDto(result.attempt.toDto(), result.solved, result.winnerId, roundSequence),
        )
        hub.broadcast(
            code,
            "guess:result",
            ChampionshipGuessResultDto(redactAttempt(result.attempt.toDto()), result.solved, result.winnerId, roundSequence),
            exceptConnectionId = connection.id(),
        )
        sink.end()
    }

    private fun handleDisconnect(connection: WebSocketConnection) {
        val state = sessions.remove(connection.id())
        hub.leave(connection)
        if (state == null) return

        val record = deps.roomRepository.findByCode(state.code) ?: return

        if (record.status == RoomStatus.LOBBY) {
            try {
                val result = leaveRoom(deps, LeaveRoomInput(state.code, state.playerId))
                val leavingRecord = result.record
                if (!result.deleted && leavingRecord != null) {
                    hub.broadcast(state.code, "lobby:state", leavingRecord.toDto())
                    result.hostMigratedTo?.let { hostId ->
                        deps.hostMigrationTracker.cancel(state.code)
                        hub.broadcast(state.code, "host:migrated", HostMigratedDto(state.code, hostId))
                    }
                }
            } catch (_: Exception) {
                // Room already gone — nothing to do.
            }
        } else if (record.hostId == state.playerId) {
            deps.hostMigrationTracker.onHostDisconnected(state.code) {
                val result = migrateHost(deps, MigrateHostInput(state.code))
                result.newHostId?.let { hostId ->
                    hub.broadcast(state.code, "host:migrated", HostMigratedDto(state.code, hostId))
                    hub.broadcast(state.code, "lobby:state", result.record.toDto())
                }
            }
        }
    }

    private fun buildRoomState(
        gameMode: ChampionshipMode,
        game: io.termo.domain.entities.Game,
        room: io.termo.domain.entities.Room,
        viewerPlayerId: String,
        attempts: List<io.termo.presentation.dto.AttemptDto>? = null,
        solvedBy: String? = game.currentRound.solvedBy,
    ): RoomStateDto {
        val snapshot = gameMode.currentRoundSnapshot()
        return RoomStateDto(
            roundSequence = snapshot.roundSequence,
            wordIndex = snapshot.wordIndex,
            wordCount = snapshot.wordCount,
            wordLength = snapshot.wordLength,
            maxAttempts = snapshot.maxAttempts,
            timeLimitMs = snapshot.timeLimitMs,
            roundStartedAt = snapshot.roundStartedAt,
            phase = snapshot.phase,
            tieBreakCandidates = snapshot.tieBreakCandidates,
            players = room.players.values.map { RoomPlayerDto(it.playerId, it.nickname) },
            scores = LinkedHashMap(game.scores),
            attempts = attempts
                ?: redactAttemptsForViewer(game.currentRound.attempts.map { it.toDto() }, viewerPlayerId),
            solvedBy = solvedBy,
        )
    }

    private fun sendError(connection: WebSocketConnection, event: String, message: String, code: String? = null) {
        hub.send(connection, event, ErrorDto(message = message, code = code))
    }
}
