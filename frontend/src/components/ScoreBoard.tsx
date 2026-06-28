import type { Player } from '../lib/types';

interface ScoreBoardProps {
  players: Player[];
  scores: Record<string, number>;
  tieBreakCandidates: string[] | null;
  ownPlayerId: string;
}

export function ScoreBoard({ players, scores, tieBreakCandidates, ownPlayerId }: ScoreBoardProps) {
  const ranked = [...players].sort((a, b) => (scores[b.playerId] ?? 0) - (scores[a.playerId] ?? 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
      <h2 style={{ margin: 0 }}>Placar</h2>
      {ranked.map((player) => {
        const isTieBreakCandidate = tieBreakCandidates?.includes(player.playerId) ?? false;
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
              {tieBreakCandidates ? (isTieBreakCandidate ? '⚔️ ' : '👀 ') : ''}
              {player.nickname}
            </span>
            <strong>{scores[player.playerId] ?? 0}</strong>
          </div>
        );
      })}
      {ranked.length === 0 && <p>Nenhum jogador ainda.</p>}
    </div>
  );
}
