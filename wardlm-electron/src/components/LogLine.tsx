import React from 'react';
import { LineRecord } from './App';

function LogLineImpl({ rec }: { rec: LineRecord }): JSX.Element {
  return (
    <div className="line" data-level={rec.level ?? 'none'}>
      <span className="line__text">{rec.text || ' '}</span>
    </div>
  );
}

export const LogLine = React.memo(LogLineImpl);
