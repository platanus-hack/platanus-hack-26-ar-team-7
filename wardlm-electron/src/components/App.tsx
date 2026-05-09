import React, {
  useEffect,
  useMemo,
  useReducer,
  useDeferredValue,
} from 'react';
import { InitialPayload, LogErrorPayload, StatsPayload } from '../shared';
import { Level, detectLevel } from './levels';
import { TitleBar } from './TitleBar';
import { Toolbar } from './Toolbar';
import { LogView } from './LogView';
import { StatusBar } from './StatusBar';
import { PermissionCard } from './PermissionCard';
import { ErrorCard } from './ErrorCard';
import { Sidebar, View } from './Sidebar';
import { DashboardStats, HomeDashboard } from './HomeDashboard';
import { SettingsView } from './SettingsView';

const MAX_LINES = 5000;

export type LineRecord = {
  id: number;
  text: string;
  level: Level | null;
};

type State = {
  path: string;
  lines: LineRecord[];
  totalSeen: number;
  query: string;
  enabledLevels: Set<Level | 'none'>;
  autoScroll: boolean;
  newCount: number;
  theme: 'light' | 'dark';
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
  | { type: 'TOGGLE_LEVEL'; level: Level | 'none' }
  | { type: 'TOGGLE_AUTOSCROLL'; value?: boolean }
  | { type: 'RESET_NEW_COUNT' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SET_STATS'; stats: StatsPayload };

const ALL_LEVELS = new Set<Level | 'none'>([
  'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'none',
]);

function loadTheme(): 'light' | 'dark' {
  try {
    const v = localStorage.getItem('wardlm.theme');
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function parseDecision(text: string): 'allow' | 'deny' | null {
  try {
    const obj = JSON.parse(text) as { decision?: unknown };
    if (obj.decision === 'allow') return 'allow';
    if (obj.decision === 'deny') return 'deny';
  } catch {
    /* not JSONL — ignore */
  }
  return null;
}

const initialState: State = {
  path: '/var/log/wardlm/wardlm.log',
  lines: [],
  totalSeen: 0,
  query: '',
  enabledLevels: new Set(ALL_LEVELS),
  autoScroll: true,
  newCount: 0,
  theme: loadTheme(),
  error: null,
  rotatedAt: null,
  lastEventAt: null,
  status: 'connecting',
  nextId: 0,
  view: 'home',
  stats: { total: 0, allowed: 0, denied: 0 },
};

function makeRecord(text: string, id: number): LineRecord {
  return { id, text, level: detectLevel(text) };
}

function appendLine(state: State, text: string): State {
  const rec = makeRecord(text, state.nextId);
  let lines = state.lines;
  if (lines.length >= MAX_LINES) {
    lines = lines.slice(lines.length - MAX_LINES + 1);
  }
  const decision = parseDecision(text);
  const stats: DashboardStats = {
    total: state.stats.total + 1,
    allowed: state.stats.allowed + (decision === 'allow' ? 1 : 0),
    denied: state.stats.denied + (decision === 'deny' ? 1 : 0),
  };
  return {
    ...state,
    lines: [...lines, rec],
    totalSeen: state.totalSeen + 1,
    newCount: state.autoScroll ? 0 : state.newCount + 1,
    lastEventAt: Date.now(),
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
      const lines = action.payload.lines.map((t) => makeRecord(t, id++));
      const err = action.payload.error;
      return {
        ...state,
        path: action.payload.path,
        lines,
        totalSeen: lines.length,
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
    case 'TOGGLE_LEVEL': {
      const next = new Set(state.enabledLevels);
      if (next.has(action.level)) next.delete(action.level);
      else next.add(action.level);
      return { ...state, enabledLevels: next };
    }
    case 'TOGGLE_AUTOSCROLL': {
      const value = action.value ?? !state.autoScroll;
      return { ...state, autoScroll: value, newCount: value ? 0 : state.newCount };
    }
    case 'RESET_NEW_COUNT':
      return { ...state, newCount: 0 };
    case 'TOGGLE_THEME': {
      const theme = state.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('wardlm.theme', theme); } catch { /* ignore */ }
      return { ...state, theme };
    }
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_STATS':
      return {
        ...state,
        stats: {
          total: action.stats.total,
          allowed: action.stats.allowed,
          denied: action.stats.denied,
        },
      };
    default:
      return state;
  }
}

export function App(): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

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

  const visibleLines = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const allLevels = state.enabledLevels.size === ALL_LEVELS.size;
    if (!q && allLevels) return state.lines;
    return state.lines.filter((rec) => {
      if (!allLevels) {
        const key: Level | 'none' = rec.level ?? 'none';
        if (!state.enabledLevels.has(key)) return false;
      }
      if (q && !rec.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.lines, deferredQuery, state.enabledLevels]);

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

  if (state.error && state.lines.length === 0 && state.view === 'logs') {
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
          <HomeDashboard stats={state.stats} />
        ) : state.view === 'settings' ? (
          <SettingsView
            theme={state.theme}
            onToggleTheme={() => dispatch({ type: 'TOGGLE_THEME' })}
          />
        ) : (
          <>
            <TitleBar path={state.path} />
            <Toolbar
              query={state.query}
              enabledLevels={state.enabledLevels}
              autoScroll={state.autoScroll}
              onQueryChange={(q) => dispatch({ type: 'SET_QUERY', query: q })}
              onToggleLevel={(level) => dispatch({ type: 'TOGGLE_LEVEL', level })}
              onToggleAutoScroll={() => dispatch({ type: 'TOGGLE_AUTOSCROLL' })}
            />
            <LogView
              lines={visibleLines}
              autoScroll={state.autoScroll}
              newCount={state.newCount}
              onUserScrollUp={() =>
                dispatch({ type: 'TOGGLE_AUTOSCROLL', value: false })
              }
              onJumpToLatest={() =>
                dispatch({ type: 'TOGGLE_AUTOSCROLL', value: true })
              }
            />
            <StatusBar
              totalSeen={state.totalSeen}
              visible={visibleLines.length}
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
