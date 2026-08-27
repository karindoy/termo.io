import type { DailyStats } from '../lib/daily-stats-storage';
import { useNextPuzzleCountdown } from '../hooks/useNextPuzzleCountdown';

interface DailyStatsModalProps {
  stats: DailyStats;
  maxAttempts: number;
  onDismiss: () => void;
  onShare: () => void;
}

function winPercent(stats: DailyStats): number {
  return stats.gamesPlayed === 0 ? 0 : Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
}

export function DailyStatsModal({ stats, maxAttempts, onDismiss, onShare }: DailyStatsModalProps) {
  const countdown = useNextPuzzleCountdown();
  const attemptCounts = Array.from({ length: maxAttempts }, (_, i) => stats.distribution[i + 1] ?? 0);
  const maxCount = Math.max(1, ...attemptCounts, stats.losses);

  return (
    <div id="daily-stats-modal-overlay" className="modal-overlay" onClick={onDismiss}>
      <div
        id="daily-stats-modal-card"
        className="modal-card stats-modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="stats-modal-close" onClick={onDismiss} aria-label="Fechar">
          ×
        </button>

        <p className="modal-title">progresso</p>

        <div className="stats-grid">
          <div className="stats-tile">
            <span className="stats-tile-value">{stats.gamesPlayed}</span>
            <span className="stats-tile-label">jogos</span>
          </div>
          <div className="stats-tile">
            <span className="stats-tile-value">{winPercent(stats)}%</span>
            <span className="stats-tile-label">de vitórias</span>
          </div>
          <div className="stats-tile">
            <span className="stats-tile-value">{stats.currentStreak}</span>
            <span className="stats-tile-label">sequência de vitórias</span>
          </div>
          <div className="stats-tile">
            <span className="stats-tile-value">{stats.bestStreak}</span>
            <span className="stats-tile-label">melhor sequência</span>
          </div>
        </div>

        <div className="stats-distribution">
          <p className="stats-section-title">distribuição de tentativas</p>
          {attemptCounts.map((count, index) => (
            <div className="stats-dist-row" key={index}>
              <span className="stats-dist-label">{index + 1}</span>
              {count === 0 ? (
                <span className="stats-dist-empty">Ø</span>
              ) : (
                <div className="stats-dist-track">
                  <div className="stats-dist-bar" style={{ width: `${Math.max(12, (count / maxCount) * 100)}%` }}>
                    {count}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="stats-dist-row">
            <span className="stats-dist-label" aria-label="Derrotas">
              💀
            </span>
            {stats.losses === 0 ? (
              <span className="stats-dist-empty">Ø</span>
            ) : (
              <div className="stats-dist-track">
                <div
                  className="stats-dist-bar stats-dist-bar-loss"
                  style={{ width: `${Math.max(12, (stats.losses / maxCount) * 100)}%` }}
                >
                  {stats.losses}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="stats-modal-footer">
          <div className="stats-countdown">
            <span className="stats-countdown-label">próxima palavra em</span>
            <span className="stats-countdown-value">{countdown}</span>
          </div>
          <button className="btn btn-primary stats-share-btn" onClick={onShare}>
            compartilhe ↗
          </button>
        </div>
      </div>
    </div>
  );
}
