import * as os from 'os';
import * as path from 'path';

const APP_DIR = 'wardlm';

function xdgDir(envVar: string, fallback: string): string {
  const v = process.env[envVar];
  if (v && path.isAbsolute(v)) return v;
  return path.join(os.homedir(), fallback);
}

export const XDG_CONFIG_HOME = xdgDir('XDG_CONFIG_HOME', '.config');
export const XDG_STATE_HOME = xdgDir('XDG_STATE_HOME', path.join('.local', 'state'));
export const XDG_DATA_HOME = xdgDir('XDG_DATA_HOME', path.join('.local', 'share'));
export const XDG_CACHE_HOME = xdgDir('XDG_CACHE_HOME', '.cache');

export const CONFIG_DIR = path.join(XDG_CONFIG_HOME, APP_DIR);
export const STATE_DIR = path.join(XDG_STATE_HOME, APP_DIR);
export const DATA_DIR = path.join(XDG_DATA_HOME, APP_DIR);
export const CACHE_DIR = path.join(XDG_CACHE_HOME, APP_DIR);

export const SETTINGS_PATH = path.join(CONFIG_DIR, 'settings.json');
export const LOG_PATH = '/var/log/wardlm/wardlm.log';
