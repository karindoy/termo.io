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
    <div id="placar" className="card" style={{ minWidth: 200 }}>
      <h2>Placar</h2>
      {ranked.map((player) => {
        const isTieBreakCandidate = tieBreakCandidates?.includes(player.playerId) ?? false;
        return (
          <div key={player.playerId} className={['row-item', player.playerId === ownPlayerId ? 'is-self' : ''].join(' ').trim()}>
            <span>
              {tieBreakCandidates ? (isTieBreakCandidate ? '⚔️ ' : '👀 ') : ''}
              {player.nickname}
            </span>
            <strong>{scores[player.playerId] ?? 0}</strong>
          </div>
        );
      })}
      {ranked.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nenhum jogador ainda.</p>}
    </div>
  );
}
