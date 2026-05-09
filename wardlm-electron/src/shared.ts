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

export type AgentKey = 'claudeCode' | 'codex' | 'other';
export type AgentBreakdown = { total: number; allowed: number; denied: number };

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
