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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
      <h2 style={{ margin: 0 }}>Corrida</h2>
      {ranked.map((player) => {
        const entry = progress[player.playerId];
        const wordIndex = entry?.wordIndex ?? 0;
        return (
          <div
            key={player.playerId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 8px',
              borderRadius: 4,
              background: player.playerId === ownPlayerId ? '#2a2a2c' : 'transparent',
            }}
          >
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
      {ranked.length === 0 && <p>Nenhum jogador ainda.</p>}
    </div>
  );
}
