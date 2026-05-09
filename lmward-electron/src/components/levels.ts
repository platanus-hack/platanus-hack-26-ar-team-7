export const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
export type Level = typeof LEVELS[number];

const LEVEL_RE = /\b(FATAL|ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/;

export function detectLevel(line: string): Level | null {
  const m = LEVEL_RE.exec(line);
  if (!m) return null;
  const tok = m[1].toLowerCase();
  if (tok === 'warning') return 'warn';
  return tok as Level;
}
