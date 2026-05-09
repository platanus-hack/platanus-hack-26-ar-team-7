import React from 'react';
import { ColumnFilters, FilterField } from './App';

type Props = {
  query: string;
  columnFilters: ColumnFilters;
  autoScroll: boolean;
  onQueryChange: (q: string) => void;
  onRemoveFilter: (field: FilterField, value: string) => void;
  onClearFilters: () => void;
  onToggleAutoScroll: () => void;
};

const FIELD_LABELS: Record<FilterField, string> = {
  agent: 'agent',
  decision: 'decision',
  reason: 'reason',
  path: 'path',
  pid: 'pid',
};

export function Toolbar({
  query,
  columnFilters,
  autoScroll,
  onQueryChange,
  onRemoveFilter,
  onClearFilters,
  onToggleAutoScroll,
}: Props): JSX.Element {
  const chips: { field: FilterField; value: string }[] = [];
  (Object.keys(columnFilters) as FilterField[]).forEach((field) => {
    const set = columnFilters[field];
    if (!set) return;
    set.forEach((value) => chips.push({ field, value }));
  });

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
      <div className="filter-chips" role="group" aria-label="Active filters">
        {chips.map(({ field, value }) => (
          <button
            key={`${field}:${value}`}
            type="button"
            className="filter-chip"
            onClick={() => onRemoveFilter(field, value)}
            title={`Remove filter ${field} = ${value}`}
          >
            <span className="filter-chip__field">{FIELD_LABELS[field]}</span>
            <span className="filter-chip__value">{value}</span>
            <span className="filter-chip__close" aria-hidden="true">×</span>
          </button>
        ))}
        {chips.length > 0 && (
          <button
            type="button"
            className="btn btn--small filter-chips__clear"
            onClick={onClearFilters}
          >
            Clear all
          </button>
        )}
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
