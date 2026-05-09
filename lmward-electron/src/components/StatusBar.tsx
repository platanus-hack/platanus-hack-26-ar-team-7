import React, { useEffect, useState } from 'react';

type Props = {
  totalSeen: number;
  visible: number;
  lastEventAt: number | null;
  rotatedAt: number | null;
  status: 'connecting' | 'live' | 'error';
  errorMessage: string | null;
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function StatusBar({
  totalSeen,
  visible,
  lastEventAt,
  rotatedAt,
  status,
  errorMessage,
}: Props): JSX.Element {
  const [rotatedFlash, setRotatedFlash] = useState(false);

  useEffect(() => {
    if (rotatedAt == null) return;
    setRotatedFlash(true);
    const t = setTimeout(() => setRotatedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [rotatedAt]);

  return (
    <footer className="statusbar">
      <span className="statusbar__item">
        <span className="statusbar__label">Lines</span>
        <span className="statusbar__value">{totalSeen.toLocaleString()}</span>
      </span>
      <span className="statusbar__item">
        <span className="statusbar__label">Visible</span>
        <span className="statusbar__value">{visible.toLocaleString()}</span>
      </span>
      <span className="statusbar__item">
        <span className="statusbar__label">Last event</span>
        <span className="statusbar__value">
          {lastEventAt ? formatTime(lastEventAt) : '—'}
        </span>
      </span>
      {rotatedFlash && (
        <span className="statusbar__item statusbar__item--rotated">
          rotated
        </span>
      )}
      <span className="statusbar__spacer" />
      <span className="statusbar__item">
        <span className={`status status--${status}`}>
          <span className="status__dot" />
          <span className="status__label">
            {status === 'live'
              ? 'Watching'
              : status === 'connecting'
              ? 'Connecting'
              : errorMessage ?? 'Error'}
          </span>
        </span>
      </span>
    </footer>
  );
}
