import React, { useCallback, useMemo, useRef, useState } from 'react';
import { TableVirtuoso, TableVirtuosoHandle } from 'react-virtuoso';
import { FilterField, LogEntry } from './App';

type Props = {
  entries: LogEntry[];
  autoScroll: boolean;
  newCount: number;
  onAddFilter: (field: FilterField, value: string) => void;
  onUserScrollUp: () => void;
  onJumpToLatest: () => void;
};

const NEAR_BOTTOM_PX = 8;

const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatTs(ts: number): string {
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const parts = dateFmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function decisionClass(decision: string): string {
  if (decision === 'allow') return 'decision decision--allow';
  if (decision === 'deny') return 'decision decision--deny';
  return 'decision decision--other';
}

function prettyJson(entry: LogEntry): string {
  try {
    return JSON.stringify(JSON.parse(entry.raw), null, 2);
  } catch {
    return JSON.stringify(
      {
        ts: entry.ts,
        agent: entry.agent,
        decision: entry.decision,
        reason: entry.reason,
        pid: entry.pid,
        path: entry.path,
        argv: entry.argv,
      },
      null,
      2,
    );
  }
}

type FilterCellProps = {
  field: FilterField;
  value: string;
  onAddFilter: (field: FilterField, value: string) => void;
  className?: string;
  title?: string;
  children?: React.ReactNode;
};

const FilterCell = React.memo(function FilterCell({
  field,
  value,
  onAddFilter,
  className,
  title,
  children,
}: FilterCellProps): JSX.Element {
  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    onAddFilter(field, value);
  };
  return (
    <button
      type="button"
      className={`cell-filter${className ? ` ${className}` : ''}`}
      onClick={handle}
      title={title ?? `Filter ${field} = ${value}`}
    >
      {children ?? value}
    </button>
  );
});

type RowProps = {
  entry: LogEntry;
  expanded: boolean;
  expandedJson: string | null;
  onAddFilter: (field: FilterField, value: string) => void;
};

const LogRow = React.memo(function LogRow({
  entry,
  expanded,
  expandedJson,
  onAddFilter,
}: RowProps): JSX.Element {
  const argvJoined = entry.argv.join(' ');
  return (
    <>
      <td className="col-ts">{formatTs(entry.ts)}</td>
      <td className="col-agent">
        <FilterCell field="agent" value={entry.agent} onAddFilter={onAddFilter} />
      </td>
      <td className="col-decision">
        <FilterCell
          field="decision"
          value={entry.decision}
          onAddFilter={onAddFilter}
          className={decisionClass(entry.decision)}
        />
      </td>
      <td className="col-reason">
        <FilterCell field="reason" value={entry.reason} onAddFilter={onAddFilter} />
      </td>
      <td className="col-pid">
        <FilterCell field="pid" value={String(entry.pid)} onAddFilter={onAddFilter} />
      </td>
      <td className="col-path">
        <FilterCell field="path" value={entry.path} onAddFilter={onAddFilter} title={entry.path} />
      </td>
      <td className="col-argv" title={argvJoined}>
        <span className="argv-preview">{argvJoined}</span>
      </td>
      {expanded && expandedJson !== null && (
        <td className="col-expanded">
          <pre>{expandedJson}</pre>
        </td>
      )}
    </>
  );
});

function renderHeader(): JSX.Element {
  return (
    <tr>
      <th className="col-ts">Time</th>
      <th className="col-agent">Agent</th>
      <th className="col-decision">Decision</th>
      <th className="col-reason">Reason</th>
      <th className="col-pid">PID</th>
      <th className="col-path">Path</th>
      <th className="col-argv">Argv</th>
    </tr>
  );
}

function EmptyPlaceholder(): JSX.Element {
  return (
    <tr>
      <td colSpan={7} className="logtable__empty">
        Waiting for log entries…
      </td>
    </tr>
  );
}

export function LogTable({
  entries,
  autoScroll,
  newCount,
  onAddFilter,
  onUserScrollUp,
  onJumpToLatest,
}: Props): JSX.Element {
  const ref = useRef<TableVirtuosoHandle>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const expandedEntry = useMemo(
    () => (expandedId === null ? null : entries.find((e) => e.id === expandedId) ?? null),
    [expandedId, entries],
  );
  const expandedJson = useMemo(
    () => (expandedEntry ? prettyJson(expandedEntry) : null),
    [expandedEntry],
  );

  const handleAtBottomChange = useCallback(
    (atBottom: boolean) => {
      if (autoScroll && !atBottom) onUserScrollUp();
    },
    [autoScroll, onUserScrollUp],
  );

  const handleFollowOutput = useCallback(
    (isAtBottom: boolean): false | 'auto' => (autoScroll && isAtBottom ? 'auto' : false),
    [autoScroll],
  );

  const handleRowClick = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const itemContent = useCallback(
    (_index: number, entry: LogEntry) => (
      <LogRow
        entry={entry}
        expanded={expandedId === entry.id}
        expandedJson={expandedId === entry.id ? expandedJson : null}
        onAddFilter={onAddFilter}
      />
    ),
    [expandedId, expandedJson, onAddFilter],
  );

  const components = useMemo(
    () => ({
      EmptyPlaceholder,
      Table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
        <table {...props} className="logtable" />
      ),
      TableRow: (props: React.HTMLAttributes<HTMLTableRowElement> & { 'data-index'?: number }) => {
        const idx = props['data-index'];
        const id = typeof idx === 'number' ? entries[idx]?.id : undefined;
        const expanded = id !== undefined && id === expandedId;
        return (
          <tr
            {...props}
            className={`logrow${expanded ? ' logrow--expanded' : ''}`}
            onClick={() => id !== undefined && handleRowClick(id)}
          />
        );
      },
    }),
    [entries, expandedId, handleRowClick],
  );

  const handleJump = () => {
    ref.current?.scrollToIndex({ index: entries.length - 1, align: 'end' });
    onJumpToLatest();
  };

  return (
    <div className="logtable-wrap">
      <TableVirtuoso
        ref={ref}
        data={entries}
        computeItemKey={(_, entry) => entry.id}
        followOutput={handleFollowOutput}
        atBottomStateChange={handleAtBottomChange}
        atBottomThreshold={NEAR_BOTTOM_PX}
        increaseViewportBy={{ top: 200, bottom: 400 }}
        fixedHeaderContent={renderHeader}
        itemContent={itemContent}
        components={components}
        className="logtable-scroll"
        style={{ flex: '1 1 auto', minHeight: 0 }}
      />
      {!autoScroll && newCount > 0 && (
        <button type="button" className="jump-pill" onClick={handleJump}>
          Jump to latest · {newCount} new
        </button>
      )}
    </div>
  );
}
