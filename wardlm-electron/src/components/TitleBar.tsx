import React from 'react';

type Props = {
  path: string;
  status: 'connecting' | 'live' | 'error';
};

const STATUS_LABEL: Record<Props['status'], string> = {
  connecting: 'Connecting',
  live: 'Live',
  error: 'Error',
};

export function TitleBar({ path, status }: Props): JSX.Element {
  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <span className="titlebar__name">wardlm audit log</span>
      </div>
      <div className="titlebar__meta">
        <span className="titlebar__path" title={path}>{path}</span>
        <span className={`status status--${status}`} aria-label={STATUS_LABEL[status]}>
          <span className="status__dot" />
          <span className="status__label">{STATUS_LABEL[status]}</span>
        </span>
      </div>
    </header>
  );
}
