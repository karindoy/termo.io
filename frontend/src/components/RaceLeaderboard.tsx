import type { Player, PlayerProgressSnapshot } from '../lib/types';

interface RaceLeaderboardProps {
  players: Player[];
  progress: Record<string, PlayerProgressSnapshot>;
  wordCount: number;
  ownPlayerId: string;
}

export function RaceLeaderboard({ players, progress, wordCount, ownPlayerId }: RaceLeaderboardProps) {
  const ranked = [...players].sort(
    (a, b) => (progress[b.playerId]?.wordIndex ?? 0) - (progress[a.playerId]?.wordIndex ?? 0),
  );

  return (
    <div id="placar" className="card" style={{ minWidth: 220 }}>
      <h2>Corrida</h2>
      {ranked.map((player) => {
        const entry = progress[player.playerId];
        const wordIndex = entry?.wordIndex ?? 0;
        return (
          <div key={player.playerId} className={['row-item', player.playerId === ownPlayerId ? 'is-self' : ''].join(' ').trim()}>
            <span>
              {entry?.won ? '🏆 ' : entry?.finished ? '✅ ' : ''}
              {player.nickname}
            </span>
            <strong>
              {Math.min(wordIndex + 1, wordCount)}/{wordCount}
            </strong>
          </div>
        );
      })}
      {ranked.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum jogador ainda.</p>}
    </div>
  );
}
