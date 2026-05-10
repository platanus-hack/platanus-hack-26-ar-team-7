import React from 'react';
import { Boxes } from 'lucide-react';
import { AGENTS, AgentBreakdown, AgentKey, shimsForAgentKey } from '../shared';
import { FilterField } from './App';
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

export type DashboardFilters = Partial<Record<FilterField, string[]>>;

type Props = {
  stats: DashboardStats;
  onNavigate: (filters: DashboardFilters) => void;
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

export function HomeDashboard({ stats, onNavigate }: Props): JSX.Element {
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
        <StatCard
          label="Commands executed"
          value={stats.total}
          tone="accent"
          onClick={() => onNavigate({})}
          title="View all commands in logs"
        />
        <StatCard
          label="Approved"
          value={stats.allowed}
          tone="emerald"
          onClick={() => onNavigate({ decision: ['allow'] })}
          title="View approved commands in logs"
        />
        <StatCard
          label="Denied"
          value={stats.denied}
          tone="rose"
          onClick={() => onNavigate({ decision: ['deny'] })}
          title="View denied commands in logs"
        />
      </div>

      <h2 className="dashboard__section-title">Agents</h2>
      <div className="agents">
        {active.map((r) => (
          <AgentRow
            key={r.key}
            agentKey={r.key}
            icon={AGENT_ICONS[r.key]}
            label={r.label}
            breakdown={r.breakdown}
            onNavigate={onNavigate}
          />
        ))}
        {inactive.length > 0 && (
          <details className="agents__inactive">
            <summary>Inactive ({inactive.length})</summary>
            {inactive.map((r) => (
              <AgentRow
                key={r.key}
                agentKey={r.key}
                icon={AGENT_ICONS[r.key]}
                label={r.label}
                breakdown={r.breakdown}
                onNavigate={onNavigate}
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
  onClick: () => void;
  title: string;
};

function StatCard({ label, value, tone, onClick, title }: StatCardProps): JSX.Element {
  return (
    <button
      type="button"
      className={`stat-card stat-card--${tone} stat-card--clickable`}
      onClick={onClick}
      title={title}
    >
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{fmt.format(value)}</div>
    </button>
  );
}

type AgentRowProps = {
  agentKey: AgentKey;
  icon: JSX.Element;
  label: string;
  breakdown: AgentBreakdown;
  onNavigate: (filters: DashboardFilters) => void;
};

function AgentRow({
  agentKey,
  icon,
  label,
  breakdown,
  onNavigate,
}: AgentRowProps): JSX.Element {
  const isOther = agentKey === 'other';
  const shims = isOther ? [] : shimsForAgentKey(agentKey);

  const head = (
    <div className="agent-row__head">
      <span className="agent-row__icon" aria-hidden="true">{icon}</span>
      <span className="agent-row__label">{label}</span>
    </div>
  );

  const stats = (
    <div className="agent-row__stats">
      <AgentStat
        label="Total"
        value={breakdown.total}
        tone="accent"
        onClick={isOther ? undefined : () => onNavigate({ agent: shims })}
        title={isOther ? undefined : `View all ${label} commands in logs`}
      />
      <AgentStat
        label="Approved"
        value={breakdown.allowed}
        tone="emerald"
        onClick={
          isOther
            ? undefined
            : () => onNavigate({ agent: shims, decision: ['allow'] })
        }
        title={isOther ? undefined : `View approved ${label} commands in logs`}
      />
      <AgentStat
        label="Denied"
        value={breakdown.denied}
        tone="rose"
        onClick={
          isOther
            ? undefined
            : () => onNavigate({ agent: shims, decision: ['deny'] })
        }
        title={isOther ? undefined : `View denied ${label} commands in logs`}
      />
    </div>
  );

  if (isOther) {
    return (
      <div className="agent-row">
        {head}
        {stats}
      </div>
    );
  }

  const handleClick = () => onNavigate({ agent: shims });
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className="agent-row agent-row--clickable"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={`View ${label} commands in logs`}
    >
      {head}
      {stats}
    </div>
  );
}

type AgentStatProps = {
  label: string;
  value: number;
  tone: 'accent' | 'emerald' | 'rose';
  onClick?: () => void;
  title?: string;
};

function AgentStat({ label, value, tone, onClick, title }: AgentStatProps): JSX.Element {
  if (!onClick) {
    return (
      <div className={`agent-stat agent-stat--${tone}`}>
        <div className="agent-stat__label">{label}</div>
        <div className="agent-stat__value">{fmt.format(value)}</div>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`agent-stat agent-stat--${tone} agent-stat--clickable`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
    >
      <div className="agent-stat__label">{label}</div>
      <div className="agent-stat__value">{fmt.format(value)}</div>
    </button>
  );
}
