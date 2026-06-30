import type { Player } from '../lib/types';
import type { RaceRevealInfo } from '../hooks/useRaceGame';

interface RaceSummaryProps {
  revealHistory: RaceRevealInfo[];
  players: Player[];
}

export function RaceSummary({ revealHistory, players }: RaceSummaryProps) {
  return (
    <div className="card">
      <h2>Palavras da corrida</h2>
      <ul className="row-list">
        {revealHistory.map((reveal, index) => {
          const nickname = players.find((player) => player.playerId === reveal.playerId)?.nickname ?? 'Alguém';
          const message =
            reveal.reason === 'solved'
              ? `🎉 ${nickname} acertou: ${reveal.revealedWord}`
              : `⏰ Tempo esgotado para ${nickname}: ${reveal.revealedWord}`;
          return (
            <li key={index} className="row-item">
              <span>{message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
