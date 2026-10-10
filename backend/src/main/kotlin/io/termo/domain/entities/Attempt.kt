package io.termo.domain.entities

import io.termo.domain.valueobjects.GuessFeedback

data class Attempt(
    val playerId: String,
    val nickname: String,
    val guess: String,
    val feedback: GuessFeedback,
    val attemptNumber: Int,
    val createdAt: Long,
)
