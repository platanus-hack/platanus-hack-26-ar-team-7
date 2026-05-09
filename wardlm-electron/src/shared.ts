export const IPC = {
  GetInitial: 'log:get-initial',
  GetStats: 'log:get-stats',
  Retry: 'log:retry',
  Line: 'log:line',
  Rotated: 'log:rotated',
  Error: 'log:error',
} as const;

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
};

declare global {
  interface Window {
    wardlm: WardlmApi;
  }
}
