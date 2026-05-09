import React from 'react';
import { Boxes } from 'lucide-react';
import { AgentBreakdown, AgentKey } from '../shared';
import { ClaudeCodeIcon, CodexIcon } from './icons/AgentIcons';

export type DashboardStats = {
  total: number;
  allowed: number;
  denied: number;
  agents: Record<AgentKey, AgentBreakdown>;
};

type Props = {
  stats: DashboardStats;
};

const fmt = new Intl.NumberFormat('en-US');

export function HomeDashboard({ stats }: Props): JSX.Element {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__header-text">
          <h1 className="dashboard__title">Overview</h1>
          <p className="dashboard__subtitle">
            Lifetime totals across the entire audit log.
          </p>
        </div>
        <div className="protection-badge" role="status" aria-label="Protection enabled">
          <span className="protection-badge__dot" aria-hidden="true" />
          <span>Protection Enabled</span>
        </div>
      </header>
      <div className="dashboard__grid">
        <StatCard label="Commands executed" value={stats.total} tone="accent" />
        <StatCard label="Approved" value={stats.allowed} tone="emerald" />
        <StatCard label="Denied" value={stats.denied} tone="rose" />
      </div>

      <h2 className="dashboard__section-title">Agents</h2>
      <div className="agents">
        <AgentRow
          icon={<ClaudeCodeIcon size={22} />}
          label="Claude Code"
          breakdown={stats.agents.claudeCode}
        />
        <AgentRow
          icon={<CodexIcon size={22} />}
          label="Codex"
          breakdown={stats.agents.codex}
        />
        <AgentRow
          icon={<Boxes size={22} strokeWidth={1.75} />}
          label="Other"
          breakdown={stats.agents.other}
        />
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

type AgentRowProps = {
  icon: JSX.Element;
  label: string;
  breakdown: AgentBreakdown;
};

function AgentRow({ icon, label, breakdown }: AgentRowProps): JSX.Element {
  return (
    <div className="agent-row">
      <div className="agent-row__head">
        <span className="agent-row__icon" aria-hidden="true">{icon}</span>
        <span className="agent-row__label">{label}</span>
      </div>
      <div className="agent-row__stats">
        <AgentStat label="Total" value={breakdown.total} tone="accent" />
        <AgentStat label="Approved" value={breakdown.allowed} tone="emerald" />
        <AgentStat label="Denied" value={breakdown.denied} tone="rose" />
      </div>
    </div>
  );
}

type AgentStatProps = {
  label: string;
  value: number;
  tone: 'accent' | 'emerald' | 'rose';
};

function AgentStat({ label, value, tone }: AgentStatProps): JSX.Element {
  return (
    <div className={`agent-stat agent-stat--${tone}`}>
      <div className="agent-stat__label">{label}</div>
      <div className="agent-stat__value">{fmt.format(value)}</div>
    </div>
  );
}
