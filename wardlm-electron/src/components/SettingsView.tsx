import React from 'react';

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export function SettingsView({ theme, onToggleTheme }: Props): JSX.Element {
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
      </div>
    </div>
  );
}
