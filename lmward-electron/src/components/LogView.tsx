import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { LineRecord } from './App';
import { LogLine } from './LogLine';

type Props = {
  lines: LineRecord[];
  autoScroll: boolean;
  newCount: number;
  onUserScrollUp: () => void;
  onJumpToLatest: () => void;
};

const NEAR_BOTTOM_PX = 8;

export function LogView({
  lines,
  autoScroll,
  newCount,
  onUserScrollUp,
  onJumpToLatest,
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const internalScroll = useRef(false);

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
  }, [lines, autoScroll]);

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

  return (
    <div className="logview-wrap">
      <div ref={ref} className="logview" role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className="logview__empty">Waiting for log entries…</div>
        ) : (
          lines.map((rec) => <LogLine key={rec.id} rec={rec} />)
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
