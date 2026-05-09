export const IPC = {
  GetInitial: 'log:get-initial',
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
};

export type LmwrapApi = {
  getInitial: () => Promise<InitialPayload>;
  retry: () => Promise<void>;
  onLine: (cb: (line: string) => void) => () => void;
  onRotated: (cb: () => void) => () => void;
  onError: (cb: (err: LogErrorPayload) => void) => () => void;
};

declare global {
  interface Window {
    lmwrap: LmwrapApi;
  }
}
