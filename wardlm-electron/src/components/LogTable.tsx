import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

type CellProps = {
  field: FilterField;
  value: string;
  onAddFilter: (field: FilterField, value: string) => void;
  className?: string;
  title?: string;
  children?: React.ReactNode;
};

function FilterCell({
  field,
  value,
  onAddFilter,
  className,
  title,
  children,
}: CellProps): JSX.Element {
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
}

export function LogTable({
  entries,
  autoScroll,
  newCount,
  onAddFilter,
  onUserScrollUp,
  onJumpToLatest,
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const internalScroll = useRef(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const isNearBottom = (el: HTMLDivElement): boolean =>
    el.scrollTop + el.clientHeight >= el.scrollHeight - NEAR_BOTTOM_PX;

  useLayoutEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (!el) return;
    internalScroll.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      internalScroll.current = false;
    });
  }, [entries, autoScroll]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      if (internalScroll.current) return;
      if (autoScroll && !isNearBottom(el)) {
        onUserScrollUp();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [autoScroll, onUserScrollUp]);

  const jump = () => {
    const el = ref.current;
    if (el) {
      internalScroll.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        internalScroll.current = false;
      });
    }
    onJumpToLatest();
  };

  const toggleRow = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="logtable-wrap">
      <div ref={ref} className="logtable-scroll" role="log" aria-live="polite">
        {entries.length === 0 ? (
          <div className="logtable__empty">Waiting for log entries…</div>
        ) : (
          <table className="logtable">
            <thead>
              <tr>
                <th className="col-ts">Time</th>
                <th className="col-agent">Agent</th>
                <th className="col-decision">Decision</th>
                <th className="col-reason">Reason</th>
                <th className="col-pid">PID</th>
                <th className="col-path">Path</th>
                <th className="col-argv">Argv</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const expanded = expandedId === entry.id;
                const argvJoined = entry.argv.join(' ');
                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className={`logrow${expanded ? ' logrow--expanded' : ''}`}
                      onClick={() => toggleRow(entry.id)}
                    >
                      <td className="col-ts">{formatTs(entry.ts)}</td>
                      <td className="col-agent">
                        <FilterCell
                          field="agent"
                          value={entry.agent}
                          onAddFilter={onAddFilter}
                        />
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
                        <FilterCell
                          field="reason"
                          value={entry.reason}
                          onAddFilter={onAddFilter}
                        />
                      </td>
                      <td className="col-pid">
                        <FilterCell
                          field="pid"
                          value={String(entry.pid)}
                          onAddFilter={onAddFilter}
                        />
                      </td>
                      <td className="col-path">
                        <FilterCell
                          field="path"
                          value={entry.path}
                          onAddFilter={onAddFilter}
                          title={entry.path}
                        />
                      </td>
                      <td className="col-argv" title={argvJoined}>
                        <span className="argv-preview">{argvJoined}</span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="logrow__expanded">
                        <td colSpan={7}>
                          <pre>{prettyJson(entry)}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!autoScroll && newCount > 0 && (
        <button type="button" className="jump-pill" onClick={jump}>
          Jump to latest · {newCount} new
        </button>
      )}
    </div>
  );
}
