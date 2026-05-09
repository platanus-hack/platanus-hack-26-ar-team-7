import React, { useState } from 'react';

type Props = {
  path: string;
  message: string;
  onRetry: () => Promise<void> | void;
};

export function PermissionCard({ path, message, onRetry }: Props): JSX.Element {
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
        <h2 className="permission-card__title">Permission denied</h2>
        <p className="permission-card__body">
          Cannot read <code>{path}</code>.
        </p>
        <p className="permission-card__body">
          On Debian-based systems, audit logs in <code>/var/log</code> are
          readable by members of the <strong>adm</strong> group. Add your user
          to that group, then sign out and back in:
        </p>
        <pre className="permission-card__cmd">sudo usermod -aG adm $USER</pre>
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
