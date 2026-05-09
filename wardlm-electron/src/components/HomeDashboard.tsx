import React from 'react';
import { Boxes } from 'lucide-react';
import { AGENTS, AgentBreakdown, AgentKey } from '../shared';
import {
  AmpIcon,
  ClaudeCodeIcon,
  CodexIcon,
  CopilotIcon,
  CrewAIIcon,
  CursorIcon,
  GeminiIcon,
  GooseIcon,
  ManusIcon,
  MetaGPTIcon,
  OpenClawIcon,
  OpenCodeIcon,
} from './icons/AgentIcons';

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

const ICON_SIZE = 22;

const AGENT_ICONS: Record<AgentKey, JSX.Element> = {
  claude: <ClaudeCodeIcon size={ICON_SIZE} />,
  codex: <CodexIcon size={ICON_SIZE} />,
  copilot: <CopilotIcon size={ICON_SIZE} />,
  cursorAgent: <CursorIcon size={ICON_SIZE} />,
  gemini: <GeminiIcon size={ICON_SIZE} />,
  amp: <AmpIcon size={ICON_SIZE} />,
  goose: <GooseIcon size={ICON_SIZE} />,
  opencode: <OpenCodeIcon size={ICON_SIZE} />,
  openclaw: <OpenClawIcon size={ICON_SIZE} />,
  metagpt: <MetaGPTIcon size={ICON_SIZE} />,
  crewai: <CrewAIIcon size={ICON_SIZE} />,
  manus: <ManusIcon size={ICON_SIZE} />,
  other: <Boxes size={ICON_SIZE} strokeWidth={1.75} />,
};

type Row = { key: AgentKey; label: string; breakdown: AgentBreakdown };

export function HomeDashboard({ stats }: Props): JSX.Element {
  const rows: Row[] = [
    ...AGENTS.map((a) => ({
      key: a.key,
      label: a.label,
      breakdown: stats.agents[a.key],
    })),
    { key: 'other' as const, label: 'Other', breakdown: stats.agents.other },
  ];
  const active = rows.filter((r) => r.breakdown.total > 0);
  const inactive = rows.filter((r) => r.breakdown.total === 0);

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

      <h2 className="dashboard__section-title">Agents</h2>
      <div className="agents">
        {active.map((r) => (
          <AgentRow
            key={r.key}
            icon={AGENT_ICONS[r.key]}
            label={r.label}
            breakdown={r.breakdown}
          />
        ))}
        {inactive.length > 0 && (
          <details className="agents__inactive">
            <summary>Inactive ({inactive.length})</summary>
            {inactive.map((r) => (
              <AgentRow
                key={r.key}
                icon={AGENT_ICONS[r.key]}
                label={r.label}
                breakdown={r.breakdown}
              />
            ))}
          </details>
        )}
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
