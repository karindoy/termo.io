package io.termo.domain.entities

data class Player(
    val playerId: String,
    val nickname: String,
)

class Room(val id: String) {
    val players = LinkedHashMap<String, Player>()

    fun addPlayer(player: Player) {
        players[player.playerId] = player
    }
}
