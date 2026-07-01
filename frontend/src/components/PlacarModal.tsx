import type { ReactNode } from 'react';
import type { Player } from '../lib/types';

export type PlacarCellStatus = 'hit' | 'miss' | 'pending';

export interface PlacarWordRow {
  key: string;
  label: string;
  word: string;
  statusByPlayer: Record<string, PlacarCellStatus>;
}

interface PlacarModalProps {
  headline: string;
  players: Player[];
  rows: PlacarWordRow[];
  footer?: ReactNode;
  onDismiss: () => void;
}

const CELL_SIGN: Record<PlacarCellStatus, string> = {
  hit: '✅',
  miss: '❌',
  pending: '—',
};

export function PlacarModal({ headline, players, rows, footer, onDismiss }: PlacarModalProps) {
  return (
    <div id="placar-modal-overlay" className="modal-overlay">
      <div id="placar-modal-card" className="modal-card modal-card-large">
        <p className="modal-title">{headline}</p>

        <div className="placar-table-wrapper">
          <table className="placar-table">
            <thead>
              <tr>
                <th>Palavra</th>
                {players.map((player) => (
                  <th key={player.playerId}>{player.nickname}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.label}: {row.word}
                  </td>
                  {players.map((player) => {
                    const status = row.statusByPlayer[player.playerId] ?? 'pending';
                    return (
                      <td key={player.playerId} className={`placar-cell-${status}`}>
                        {CELL_SIGN[status]}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={players.length + 1} style={{ color: 'var(--color-text-muted)' }}>
                    Nenhuma palavra jogada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {footer && <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{footer}</p>}

        <button className="btn" onClick={onDismiss}>
          Fechar
        </button>
      </div>
    </div>
  );
}
