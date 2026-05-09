import React from 'react';

type Props = {
  path: string;
};

export function TitleBar({ path }: Props): JSX.Element {
  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <span className="titlebar__name">wardlm audit log</span>
      </div>
      <div className="titlebar__meta">
        <span className="titlebar__path" title={path}>{path}</span>
      </div>
    </header>
  );
}
