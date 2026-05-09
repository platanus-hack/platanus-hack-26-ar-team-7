import React from 'react';
import { LEVELS, Level } from './levels';

type Props = {
  query: string;
  enabledLevels: Set<Level | 'none'>;
  autoScroll: boolean;
  onQueryChange: (q: string) => void;
  onToggleLevel: (level: Level | 'none') => void;
  onToggleAutoScroll: () => void;
};

const LEVEL_LABELS: Record<Level, string> = {
  fatal: 'Fatal',
  error: 'Error',
  warn: 'Warn',
  info: 'Info',
  debug: 'Debug',
  trace: 'Trace',
};

export function Toolbar({
  query,
  enabledLevels,
  autoScroll,
  onQueryChange,
  onToggleLevel,
  onToggleAutoScroll,
}: Props): JSX.Element {
  return (
    <div className="toolbar">
      <div className="search">
        <input
          type="text"
          className="search__input"
          placeholder="Search log…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          spellCheck={false}
        />
        {query && (
          <button
            className="search__clear"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            type="button"
          >
            ×
          </button>
        )}
      </div>
      <div className="chips" role="group" aria-label="Filter by level">
        {LEVELS.map((lvl) => {
          const active = enabledLevels.has(lvl);
          return (
            <button
              key={lvl}
              type="button"
              className={`chip chip--${lvl}${active ? ' chip--active' : ''}`}
              onClick={() => onToggleLevel(lvl)}
              aria-pressed={active}
            >
              {LEVEL_LABELS[lvl]}
            </button>
          );
        })}
      </div>
      <div className="toolbar__actions">
        <button
          type="button"
          className={`btn${autoScroll ? ' btn--active' : ''}`}
          onClick={onToggleAutoScroll}
          title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
        >
          {autoScroll ? 'Pause' : 'Follow'}
        </button>
      </div>
    </div>
  );
}
