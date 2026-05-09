import React from 'react';
import { SecurityCheckKey, SecurityChecks } from '../shared';

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  securityChecks: SecurityChecks;
  onToggleSecurityCheck: (key: SecurityCheckKey) => void;
};

const SECURITY_CHECK_ROWS: ReadonlyArray<{
  key: SecurityCheckKey;
  label: string;
  hint: string;
}> = [
  {
    key: 'nonReversibleDestructive',
    label: 'Non-reversible destructive actions',
    hint: 'Block commands that cannot be undone (e.g. rm -rf, DROP TABLE).',
  },
  {
    key: 'sudoAccess',
    label: 'Sudo access',
    hint: 'Block commands that escalate privileges via sudo.',
  },
  {
    key: 'obfuscation',
    label: 'Obfuscation',
    hint: 'Block commands that hide their intent (encoded payloads, base64 pipes).',
  },
  {
    key: 'networking',
    label: 'Networking',
    hint: 'Block commands that initiate outbound network connections.',
  },
];

export function SettingsView({
  theme,
  onToggleTheme,
  securityChecks,
  onToggleSecurityCheck,
}: Props): JSX.Element {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__title">Settings</h1>
        <p className="dashboard__subtitle">Application preferences.</p>
      </header>
      <div className="settings">
        <div className="settings__row">
          <div className="settings__text">
            <div className="settings__label">Appearance</div>
            <div className="settings__hint">
              Use a dark or light color scheme for the interface.
            </div>
          </div>
          <div className="settings__control">
            <div className="segmented" role="group" aria-label="Theme">
              <button
                type="button"
                className={`segmented__btn${theme === 'light' ? ' segmented__btn--active' : ''}`}
                aria-pressed={theme === 'light'}
                onClick={() => {
                  if (theme !== 'light') onToggleTheme();
                }}
              >
                Light
              </button>
              <button
                type="button"
                className={`segmented__btn${theme === 'dark' ? ' segmented__btn--active' : ''}`}
                aria-pressed={theme === 'dark'}
                onClick={() => {
                  if (theme !== 'dark') onToggleTheme();
                }}
              >
                Dark
              </button>
            </div>
          </div>
        </div>

        <div className="settings__group-title">Security checks</div>
        {SECURITY_CHECK_ROWS.map(({ key, label, hint }) => {
          const checked = securityChecks[key];
          return (
            <div className="settings__row" key={key}>
              <div className="settings__text">
                <div className="settings__label">{label}</div>
                <div className="settings__hint">{hint}</div>
              </div>
              <div className="settings__control">
                <label className="toggle" aria-label={label}>
                  <input
                    type="checkbox"
                    className="toggle__input"
                    checked={checked}
                    onChange={() => onToggleSecurityCheck(key)}
                  />
                  <span className="toggle__slider" />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
