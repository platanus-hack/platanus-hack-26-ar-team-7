import React from 'react';

export type DashboardStats = {
  total: number;
  allowed: number;
  denied: number;
};

type Props = {
  stats: DashboardStats;
};

const fmt = new Intl.NumberFormat('en-US');

export function HomeDashboard({ stats }: Props): JSX.Element {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__title">Overview</h1>
        <p className="dashboard__subtitle">
          Lifetime totals across the entire audit log.
        </p>
      </header>
      <div className="dashboard__grid">
        <StatCard label="Commands executed" value={stats.total} tone="accent" />
        <StatCard label="Approved" value={stats.allowed} tone="emerald" />
        <StatCard label="Denied" value={stats.denied} tone="rose" />
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  tone: 'accent' | 'emerald' | 'rose';
};

function StatCard({ label, value, tone }: StatCardProps): JSX.Element {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{fmt.format(value)}</div>
    </div>
  );
}
