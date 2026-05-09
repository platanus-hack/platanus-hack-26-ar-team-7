import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DEFAULT_SETTINGS,
  SecurityChecks,
  Settings,
} from './shared';
import { SETTINGS_PATH } from './paths';

let cached: Settings = DEFAULT_SETTINGS;
let initialized = false;
let writeChain: Promise<void> = Promise.resolve();

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mergeSecurityChecks(
  base: SecurityChecks,
  patch: unknown,
): SecurityChecks {
  if (!isPlainObject(patch)) return base;
  const out: SecurityChecks = { ...base };
  for (const key of Object.keys(base) as (keyof SecurityChecks)[]) {
    const v = patch[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

function mergeSettings(base: Settings, patch: unknown): Settings {
  if (!isPlainObject(patch)) return base;
  const next: Settings = {
    theme: base.theme,
    securityChecks: { ...base.securityChecks },
  };
  if (patch.theme === 'light' || patch.theme === 'dark') {
    next.theme = patch.theme;
  }
  if ('securityChecks' in patch) {
    next.securityChecks = mergeSecurityChecks(
      next.securityChecks,
      patch.securityChecks,
    );
  }
  return next;
}

async function writeAtomic(settings: Settings): Promise<void> {
  const tmp = `${SETTINGS_PATH}.tmp`;
  const data = JSON.stringify(settings, null, 2);
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, SETTINGS_PATH);
}

export async function init(): Promise<Settings> {
  if (initialized) return cached;
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    cached = mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch {
    cached = DEFAULT_SETTINGS;
    try {
      await writeAtomic(cached);
    } catch {
      /* best-effort: filesystem unavailable, keep defaults in memory */
    }
  }
  initialized = true;
  return cached;
}

export function get(): Settings {
  return cached;
}

export async function set(patch: Partial<Settings>): Promise<Settings> {
  cached = mergeSettings(cached, patch);
  const snapshot = cached;
  writeChain = writeChain.then(() => writeAtomic(snapshot)).catch(() => {
    /* swallow write errors; in-memory state still reflects the patch */
  });
  await writeChain;
  return cached;
}
