import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useDeferredValue,
} from 'react';
import {
  AGENTS,
  AGENT_SHIM_ALIASES,
  AgentBreakdown,
  AgentKey,
  DEFAULT_SETTINGS,
  InitialPayload,
  LogErrorPayload,
  SecurityCheckKey,
  SecurityChecks,
  Settings,
  StatsPayload,
} from '../shared';
import { TitleBar } from './TitleBar';
import { Toolbar } from './Toolbar';
import { LogTable } from './LogTable';
import { StatusBar } from './StatusBar';
import { PermissionCard } from './PermissionCard';
import { ErrorCard } from './ErrorCard';
import { Sidebar, View } from './Sidebar';
import { DashboardStats, HomeDashboard } from './HomeDashboard';
import { SettingsView } from './SettingsView';

const MAX_ENTRIES = 5000;

export type LogEntry = {
  id: number;
  ts: number;
  agent: string;
  decision: string;
  reason: string;
  pid: number;
  path: string;
  argv: string[];
  raw: string;
};

export type FilterField = 'agent' | 'decision' | 'reason' | 'path' | 'pid';
export type ColumnFilters = Partial<Record<FilterField, Set<string>>>;

type State = {
  path: string;
  entries: LogEntry[];
  totalSeen: number;
  query: string;
  columnFilters: ColumnFilters;
  autoScroll: boolean;
  newCount: number;
  theme: 'light' | 'dark';
  securityChecks: SecurityChecks;
  error: LogErrorPayload | null;
  rotatedAt: number | null;
  lastEventAt: number | null;
  status: 'connecting' | 'live' | 'error';
  nextId: number;
  view: View;
  stats: DashboardStats;
};

type Action =
  | { type: 'INIT'; payload: InitialPayload }
  | { type: 'APPEND'; line: string }
  | { type: 'ROTATED' }
  | { type: 'ERROR'; err: LogErrorPayload }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'ADD_FILTER'; field: FilterField; value: string }
  | { type: 'REMOVE_FILTER'; field: FilterField; value: string }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'TOGGLE_AUTOSCROLL'; value?: boolean }
  | { type: 'RESET_NEW_COUNT' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_SECURITY_CHECK'; key: SecurityCheckKey; value: boolean }
  | { type: 'LOAD_SETTINGS'; settings: Settings }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SET_STATS'; stats: StatsPayload }
  | {
      type: 'NAVIGATE_TO_LOGS';
      filters: Partial<Record<FilterField, string[]>>;
    };

function parseEntry(text: string, id: number): LogEntry | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const ts = obj.ts;
  const decision = obj.decision;
  if (typeof ts !== 'number' || typeof decision !== 'string') return null;
  const argvRaw = obj.argv;
  const argv = Array.isArray(argvRaw) ? argvRaw.map((a) => String(a)) : [];
  return {
    id,
    ts,
    agent: typeof obj.agent === 'string' ? obj.agent : '',
    decision,
    reason: typeof obj.reason === 'string' ? obj.reason : '',
    pid: typeof obj.pid === 'number' ? obj.pid : 0,
    path: typeof obj.path === 'string' ? obj.path : '',
    argv,
    raw: text,
  };
}

const SHIM_TO_KEY: Record<string, AgentKey> = Object.fromEntries(
  AGENTS.map((a) => [a.shim, a.key]),
);
for (const [key, aliases] of Object.entries(AGENT_SHIM_ALIASES)) {
  if (!aliases) continue;
  for (const alias of aliases) SHIM_TO_KEY[alias] = key as AgentKey;
}

function toAgentKey(agent: string): AgentKey {
  return SHIM_TO_KEY[agent] ?? 'other';
}

function emptyAgents(): Record<AgentKey, AgentBreakdown> {
  const keys: AgentKey[] = [...AGENTS.map((a) => a.key), 'other'];
  return Object.fromEntries(
    keys.map((k) => [k, { total: 0, allowed: 0, denied: 0 }]),
  ) as Record<AgentKey, AgentBreakdown>;
}

const initialState: State = {
  path: '',
  entries: [],
  totalSeen: 0,
  query: '',
  columnFilters: {},
  autoScroll: true,
  newCount: 0,
  theme: DEFAULT_SETTINGS.theme,
  securityChecks: { ...DEFAULT_SETTINGS.securityChecks },
  error: null,
  rotatedAt: null,
  lastEventAt: null,
  status: 'connecting',
  nextId: 0,
  view: 'home',
  stats: {
    total: 0,
    allowed: 0,
    denied: 0,
    agents: emptyAgents(),
  },
};

function appendLine(state: State, text: string): State {
  const entry = parseEntry(text, state.nextId);
  const totalSeen = state.totalSeen + 1;
  const lastEventAt = Date.now();
  if (!entry) {
    return {
      ...state,
      totalSeen,
      lastEventAt,
      status: 'live',
      error: null,
    };
  }
  let entries = state.entries;
  if (entries.length >= MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES + 1);
  }
  const agentKey = toAgentKey(entry.agent);
  const prevBucket = state.stats.agents[agentKey];
  const stats: DashboardStats = {
    total: state.stats.total + 1,
    allowed: state.stats.allowed + (entry.decision === 'allow' ? 1 : 0),
    denied: state.stats.denied + (entry.decision === 'deny' ? 1 : 0),
    agents: {
      ...state.stats.agents,
      [agentKey]: {
        total: prevBucket.total + 1,
        allowed: prevBucket.allowed + (entry.decision === 'allow' ? 1 : 0),
        denied: prevBucket.denied + (entry.decision === 'deny' ? 1 : 0),
      },
    },
  };
  return {
    ...state,
    entries: [...entries, entry],
    totalSeen,
    newCount: state.autoScroll ? 0 : state.newCount + 1,
    lastEventAt,
    nextId: state.nextId + 1,
    status: 'live',
    error: null,
    stats,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT': {
      let id = 0;
      const entries: LogEntry[] = [];
      for (const text of action.payload.lines) {
        const e = parseEntry(text, id);
        if (e) {
          entries.push(e);
          id++;
        }
      }
      const err = action.payload.error;
      return {
        ...state,
        path: action.payload.path,
        entries,
        totalSeen: action.payload.totalLines,
        nextId: id,
        status: err ? 'error' : 'live',
        error: err,
      };
    }
    case 'APPEND':
      return appendLine(state, action.line);
    case 'ROTATED':
      return { ...state, rotatedAt: Date.now() };
    case 'ERROR':
      return { ...state, error: action.err, status: 'error' };
    case 'CLEAR_ERROR':
      return { ...state, error: null, status: 'connecting' };
    case 'SET_QUERY':
      return { ...state, query: action.query };
    case 'ADD_FILTER': {
      const next: ColumnFilters = { ...state.columnFilters };
      const existing = next[action.field];
      const set = new Set(existing ?? []);
      set.add(action.value);
      next[action.field] = set;
      return { ...state, columnFilters: next };
    }
    case 'REMOVE_FILTER': {
      const next: ColumnFilters = { ...state.columnFilters };
      const existing = next[action.field];
      if (!existing) return state;
      const set = new Set(existing);
      set.delete(action.value);
      if (set.size === 0) delete next[action.field];
      else next[action.field] = set;
      return { ...state, columnFilters: next };
    }
    case 'CLEAR_FILTERS':
      return { ...state, columnFilters: {} };
    case 'TOGGLE_AUTOSCROLL': {
      const value = action.value ?? !state.autoScroll;
      return { ...state, autoScroll: value, newCount: value ? 0 : state.newCount };
    }
    case 'RESET_NEW_COUNT':
      return { ...state, newCount: 0 };
    case 'TOGGLE_THEME': {
      const theme = state.theme === 'dark' ? 'light' : 'dark';
      return { ...state, theme };
    }
    case 'SET_SECURITY_CHECK':
      return {
        ...state,
        securityChecks: {
          ...state.securityChecks,
          [action.key]: action.value,
        },
      };
    case 'LOAD_SETTINGS':
      return {
        ...state,
        theme: action.settings.theme,
        securityChecks: { ...action.settings.securityChecks },
      };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'NAVIGATE_TO_LOGS': {
      const next: ColumnFilters = {};
      for (const [field, values] of Object.entries(action.filters)) {
        if (!values || values.length === 0) continue;
        next[field as FilterField] = new Set(values);
      }
      return { ...state, view: 'logs', columnFilters: next };
    }
    case 'SET_STATS':
      return {
        ...state,
        stats: {
          total: action.stats.total,
          allowed: action.stats.allowed,
          denied: action.stats.denied,
          agents: action.stats.agents,
        },
      };
    default:
      return state;
  }
}

function entryFieldValue(entry: LogEntry, field: FilterField): string {
  if (field === 'pid') return String(entry.pid);
  return entry[field];
}

export function App(): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  useEffect(() => {
    void window.wardlm
      .getSettings()
      .then((settings) => {
        dispatch({ type: 'LOAD_SETTINGS', settings });
        settingsLoadedRef.current = true;
      })
      .catch(() => {
        settingsLoadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    void window.wardlm.setSettings({ theme: state.theme }).catch(() => {
      /* persistence is best-effort */
    });
  }, [state.theme]);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    void window.wardlm
      .setSettings({ securityChecks: state.securityChecks })
      .catch(() => {
        /* persistence is best-effort */
      });
  }, [state.securityChecks]);

  useEffect(() => {
    let cancelled = false;

    const refreshStats = () => {
      void window.wardlm
        .getStats()
        .then((stats) => {
          if (cancelled) return;
          dispatch({ type: 'SET_STATS', stats });
        })
        .catch(() => {
          /* ignore — counts stay live via APPEND */
        });
    };

    void window.wardlm
      .getInitial()
      .then((payload) => {
        if (cancelled) return;
        dispatch({ type: 'INIT', payload });
        refreshStats();
      })
      .catch((err: Error) => {
        dispatch({
          type: 'ERROR',
          err: { code: 'EUNKNOWN', message: err.message },
        });
      });

    const offLine = window.wardlm.onLine((line) =>
      dispatch({ type: 'APPEND', line }),
    );
    const offRotated = window.wardlm.onRotated(() => {
      dispatch({ type: 'ROTATED' });
      refreshStats();
    });
    const offError = window.wardlm.onError((err) =>
      dispatch({ type: 'ERROR', err }),
    );

    return () => {
      cancelled = true;
      offLine();
      offRotated();
      offError();
    };
  }, []);

  const deferredQuery = useDeferredValue(state.query);

  const visibleEntries = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filterFields = Object.keys(state.columnFilters) as FilterField[];
    const hasFilters = filterFields.length > 0;
    if (!q && !hasFilters) return state.entries;
    return state.entries.filter((entry) => {
      for (const field of filterFields) {
        const set = state.columnFilters[field];
        if (!set || set.size === 0) continue;
        if (!set.has(entryFieldValue(entry, field))) return false;
      }
      if (q) {
        const haystack = `${entry.agent} ${entry.decision} ${entry.reason} ${entry.path} ${entry.argv.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [state.entries, deferredQuery, state.columnFilters]);

  const handleRetry = async () => {
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const payload = await window.wardlm.retry();
      dispatch({ type: 'INIT', payload });
      const stats = await window.wardlm.getStats();
      dispatch({ type: 'SET_STATS', stats });
    } catch (err) {
      const e = err as Error;
      dispatch({
        type: 'ERROR',
        err: { code: 'EUNKNOWN', message: e.message },
      });
    }
  };

  const sidebar = (
    <Sidebar
      view={state.view}
      onSelect={(view) => dispatch({ type: 'SET_VIEW', view })}
    />
  );

  if (state.error && state.entries.length === 0 && state.view === 'logs') {
    return (
      <div className="app">
        {sidebar}
        <main className="app__main">
          <TitleBar path={state.path} />
          {state.error.code === 'EACCES' ? (
            <PermissionCard
              path={state.path}
              message={state.error.message}
              onRetry={handleRetry}
            />
          ) : (
            <ErrorCard
              path={state.path}
              code={state.error.code}
              message={state.error.message}
              onRetry={handleRetry}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      {sidebar}
      <main className="app__main">
        {state.view === 'home' ? (
          <HomeDashboard
            stats={state.stats}
            onNavigate={(filters) =>
              dispatch({ type: 'NAVIGATE_TO_LOGS', filters })
            }
          />
        ) : state.view === 'settings' ? (
          <SettingsView
            theme={state.theme}
            onToggleTheme={() => dispatch({ type: 'TOGGLE_THEME' })}
            securityChecks={state.securityChecks}
            onToggleSecurityCheck={(key) =>
              dispatch({
                type: 'SET_SECURITY_CHECK',
                key,
                value: !state.securityChecks[key],
              })
            }
          />
        ) : (
          <>
            <TitleBar path={state.path} />
            <Toolbar
              query={state.query}
              columnFilters={state.columnFilters}
              autoScroll={state.autoScroll}
              onQueryChange={(q) => dispatch({ type: 'SET_QUERY', query: q })}
              onRemoveFilter={(field, value) =>
                dispatch({ type: 'REMOVE_FILTER', field, value })
              }
              onClearFilters={() => dispatch({ type: 'CLEAR_FILTERS' })}
              onToggleAutoScroll={() => dispatch({ type: 'TOGGLE_AUTOSCROLL' })}
            />
            <LogTable
              entries={visibleEntries}
              autoScroll={state.autoScroll}
              newCount={state.newCount}
              onAddFilter={(field, value) =>
                dispatch({ type: 'ADD_FILTER', field, value })
              }
              onUserScrollUp={() =>
                dispatch({ type: 'TOGGLE_AUTOSCROLL', value: false })
              }
              onJumpToLatest={() =>
                dispatch({ type: 'TOGGLE_AUTOSCROLL', value: true })
              }
            />
            <StatusBar
              totalSeen={state.totalSeen}
              visible={visibleEntries.length}
              lastEventAt={state.lastEventAt}
              rotatedAt={state.rotatedAt}
              status={state.error ? 'error' : state.status}
              errorMessage={state.error?.message ?? null}
              onRetry={handleRetry}
            />
          </>
        )}
      </main>
    </div>
  );
}
