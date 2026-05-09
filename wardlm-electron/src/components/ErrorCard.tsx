import React, { useState } from 'react';

type Props = {
  path: string;
  code: string;
  message: string;
  onRetry: () => Promise<void> | void;
};

function titleFor(code: string): string {
  if (code === 'ENOENT') return 'Log file not found';
  if (code === 'EISDIR') return 'Log path is a directory';
  return 'Cannot read log';
}

function bodyFor(code: string, path: string): React.ReactNode {
  if (code === 'ENOENT') {
    return (
      <>
        <code>{path}</code> does not exist. Make sure wardlm is installed and
        has produced at least one log entry.
      </>
    );
  }
  return (
    <>
      Failed to read <code>{path}</code>.
    </>
  );
}

export function ErrorCard({ path, code, message, onRetry }: Props): JSX.Element {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="permission-card">
      <div className="permission-card__inner">
        <h2 className="permission-card__title">{titleFor(code)}</h2>
        <p className="permission-card__body">{bodyFor(code, path)}</p>
        <p className="permission-card__detail">{message}</p>
        <div className="permission-card__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handle}
            disabled={busy}
          >
            {busy ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </div>
    </div>
  );
}
