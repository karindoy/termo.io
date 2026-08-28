import type { DailyGameMode } from '../lib/types';

const MODE_LABEL: Record<DailyGameMode, string> = {
  termo: 'Termo',
  dueto: 'Dueto',
  quarteto: 'Quarteto',
};

const MODE_ORDER: DailyGameMode[] = ['termo', 'dueto', 'quarteto'];

export function DailyModeBar({
  mode,
  onSelect,
  onHome,
}: {
  mode: DailyGameMode | null;
  onSelect: (mode: DailyGameMode) => void;
  onHome: () => void;
}) {
  return (
    <nav id="daily-mode-bar" className="mode-bar">
      <button type="button" id="mode-bar-home" className="mode-bar-tab mode-bar-home" onClick={onHome}>
        🏠 início
      </button>
      <span className="mode-bar-divider" />
      {MODE_ORDER.map((option) => (
        <button
          key={option}
          type="button"
          id={`daily-mode-bar-${option}`}
          className={`mode-bar-tab${option === mode ? ' mode-bar-tab-active' : ''}`}
          aria-current={option === mode}
          onClick={() => {
            if (option !== mode) onSelect(option);
          }}
        >
          {MODE_LABEL[option].toLowerCase()}
        </button>
      ))}
    </nav>
  );
}
