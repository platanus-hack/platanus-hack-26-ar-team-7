export const IPC = {
  GetInitial: 'log:get-initial',
  GetStats: 'log:get-stats',
  Retry: 'log:retry',
  Line: 'log:line',
  Rotated: 'log:rotated',
  Error: 'log:error',
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',
} as const;

export type SecurityCheckKey =
  | 'nonReversibleDestructive'
  | 'sudoAccess'
  | 'obfuscation'
  | 'networking';

export type SecurityChecks = Record<SecurityCheckKey, boolean>;

export type Settings = {
  theme: 'light' | 'dark';
  securityChecks: SecurityChecks;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  securityChecks: {
    nonReversibleDestructive: true,
    sudoAccess: false,
    obfuscation: false,
    networking: false,
  },
};

export type LogErrorPayload = {
  code: string;
  message: string;
};

export type InitialPayload = {
  path: string;
  lines: string[];
  totalLines: number;
  error: LogErrorPayload | null;
};

export type AgentKey =
  | 'claude'
  | 'codex'
  | 'copilot'
  | 'cursorAgent'
  | 'gemini'
  | 'amp'
  | 'goose'
  | 'opencode'
  | 'openclaw'
  | 'metagpt'
  | 'crewai'
  | 'manus'
  | 'other';
export type AgentBreakdown = { total: number; allowed: number; denied: number };

export type AgentMeta = { key: AgentKey; shim: string; label: string };

export const AGENTS: readonly AgentMeta[] = [
  { key: 'claude', shim: 'claude', label: 'Claude Code' },
  { key: 'codex', shim: 'codex', label: 'Codex' },
  { key: 'copilot', shim: 'copilot', label: 'GitHub Copilot' },
  { key: 'cursorAgent', shim: 'cursor-agent', label: 'Cursor Agent' },
  { key: 'gemini', shim: 'gemini', label: 'Gemini CLI' },
  { key: 'amp', shim: 'amp', label: 'Amp' },
  { key: 'goose', shim: 'goose', label: 'Goose' },
  { key: 'opencode', shim: 'opencode', label: 'OpenCode' },
  { key: 'openclaw', shim: 'openclaw', label: 'OpenClaw' },
  { key: 'metagpt', shim: 'metagpt', label: 'MetaGPT' },
  { key: 'crewai', shim: 'crewai', label: 'CrewAI' },
  { key: 'manus', shim: 'manus', label: 'Manus' },
];

export type StatsPayload = {
  total: number;
  allowed: number;
  denied: number;
  agents: Record<AgentKey, AgentBreakdown>;
  scannedAt: number;
};

export type WardlmApi = {
  getInitial: () => Promise<InitialPayload>;
  getStats: () => Promise<StatsPayload>;
  retry: () => Promise<InitialPayload>;
  onLine: (cb: (line: string) => void) => () => void;
  onRotated: (cb: () => void) => () => void;
  onError: (cb: (err: LogErrorPayload) => void) => () => void;
  getSettings: () => Promise<Settings>;
  setSettings: (patch: Partial<Settings>) => Promise<Settings>;
};

declare global {
  interface Window {
    wardlm: WardlmApi;
  }
}
