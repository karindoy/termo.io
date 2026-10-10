package io.termo.domain.errors

/**
 * Base type for every expected, business-level failure. Infrastructure and presentation code may
 * rely on this type to translate domain failures into transport-specific responses without leaking
 * implementation details.
 */
sealed class DomainError(message: String) : RuntimeException(message)

class InvalidWordError(message: String) : DomainError(message)

class UnauthorizedHostActionError(message: String) : DomainError(message)

class RoomAlreadyStartedError(message: String) : DomainError(message)

class AttemptsExceededError(message: String) : DomainError(message)

class RoomFullError(message: String) : DomainError(message)

class RoomNotFoundError(message: String) : DomainError(message)

class InvalidRoomSettingsError(message: String) : DomainError(message)

class InvalidGuessError(message: String) : DomainError(message)

class RoundAlreadyResolvedError(message: String) : DomainError(message)

class GameAlreadyFinishedError(message: String) : DomainError(message)
