import React, {
  useEffect,
  useMemo,
  useReducer,
  useDeferredValue,
} from 'react';
import { LogErrorPayload } from '../shared';
import { Level, detectLevel } from './levels';
import { TitleBar } from './TitleBar';
import { Toolbar } from './Toolbar';
import { LogView } from './LogView';
import { StatusBar } from './StatusBar';
import { PermissionCard } from './PermissionCard';

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
};

type Action =
  | { type: 'INIT'; path: string; lines: string[] }
  | { type: 'APPEND'; line: string }
  | { type: 'ROTATED' }
  | { type: 'ERROR'; err: LogErrorPayload }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'TOGGLE_LEVEL'; level: Level | 'none' }
  | { type: 'TOGGLE_AUTOSCROLL'; value?: boolean }
  | { type: 'RESET_NEW_COUNT' }
  | { type: 'TOGGLE_THEME' };

const ALL_LEVELS = new Set<Level | 'none'>([
  'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'none',
]);

function loadTheme(): 'light' | 'dark' {
  try {
    const v = localStorage.getItem('lmwrap.theme');
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

const initialState: State = {
  path: '/var/log/lmwrap/lmwrap.log',
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
  return {
    ...state,
    lines: [...lines, rec],
    totalSeen: state.totalSeen + 1,
    newCount: state.autoScroll ? 0 : state.newCount + 1,
    lastEventAt: Date.now(),
    nextId: state.nextId + 1,
    status: 'live',
    error: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT': {
      let id = 0;
      const lines = action.lines.map((t) => makeRecord(t, id++));
      return {
        ...state,
        path: action.path,
        lines,
        totalSeen: lines.length,
        nextId: id,
        status: 'live',
        error: null,
        lastEventAt: lines.length ? Date.now() : state.lastEventAt,
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
      try { localStorage.setItem('lmwrap.theme', theme); } catch { /* ignore */ }
      return { ...state, theme };
    }
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

    void window.lmwrap
      .getInitial()
      .then((payload) => {
        if (cancelled) return;
        dispatch({ type: 'INIT', path: payload.path, lines: payload.lines });
      })
      .catch((err: Error) => {
        dispatch({
          type: 'ERROR',
          err: { code: 'EUNKNOWN', message: err.message },
        });
      });

    const offLine = window.lmwrap.onLine((line) =>
      dispatch({ type: 'APPEND', line }),
    );
    const offRotated = window.lmwrap.onRotated(() =>
      dispatch({ type: 'ROTATED' }),
    );
    const offError = window.lmwrap.onError((err) =>
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

  if (state.error && state.error.code === 'EACCES') {
    return (
      <div className="app">
        <TitleBar
          path={state.path}
          status={state.status}
        />
        <PermissionCard
          path={state.path}
          message={state.error.message}
          onRetry={async () => {
            dispatch({ type: 'CLEAR_ERROR' });
            try {
              await window.lmwrap.retry();
              const payload = await window.lmwrap.getInitial();
              dispatch({ type: 'INIT', path: payload.path, lines: payload.lines });
            } catch (err) {
              const e = err as Error;
              dispatch({
                type: 'ERROR',
                err: { code: 'EUNKNOWN', message: e.message },
              });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <TitleBar path={state.path} status={state.status} />
      <Toolbar
        query={state.query}
        enabledLevels={state.enabledLevels}
        autoScroll={state.autoScroll}
        theme={state.theme}
        onQueryChange={(q) => dispatch({ type: 'SET_QUERY', query: q })}
        onToggleLevel={(level) => dispatch({ type: 'TOGGLE_LEVEL', level })}
        onToggleAutoScroll={() => dispatch({ type: 'TOGGLE_AUTOSCROLL' })}
        onToggleTheme={() => dispatch({ type: 'TOGGLE_THEME' })}
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
      />
    </div>
  );
}
