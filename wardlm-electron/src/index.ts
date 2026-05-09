import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { LogTailer, DEFAULT_LOG_PATH, TailerError } from './tailer';
import {
  IPC,
  InitialPayload,
  Settings,
  StatsPayload,
  AgentKey,
  AgentBreakdown,
  AGENTS,
} from './shared';
import * as settingsStore from './settingsStore';
import { CACHE_DIR, DATA_DIR, STATE_DIR } from './paths';

app.setPath('userData', DATA_DIR);
app.setPath('sessionData', DATA_DIR);
app.setPath('cache', CACHE_DIR);
app.setPath('logs', STATE_DIR);

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('password-store', 'basic');
}

if (process.env.WARDLM_REMOTE_DEBUG_PORT) {
  app.commandLine.appendSwitch(
    'remote-debugging-port',
    process.env.WARDLM_REMOTE_DEBUG_PORT,
  );
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}

Menu.setApplicationMenu(null);

const LOG_PATH = process.env.WARDLM_LOG_PATH || DEFAULT_LOG_PATH;
const RING_LIMIT = 2000;

let mainWindow: BrowserWindow | null = null;
let tailer: LogTailer | null = null;
let initialBuffer: string[] = [];
let initialTotalLines = 0;
let appendedSinceInit = 0;
let lastError: TailerError | null = null;
let startInflight: Promise<InitialPayload> | null = null;

function send(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function pushLine(line: string): void {
  initialBuffer.push(line);
  if (initialBuffer.length > RING_LIMIT) {
    initialBuffer.splice(0, initialBuffer.length - RING_LIMIT);
  }
}

function attachTailerEvents(t: LogTailer): void {
  t.on('line', (line: string) => {
    lastError = null;
    pushLine(line);
    appendedSinceInit++;
    send(IPC.Line, line);
  });
  t.on('rotated', () => {
    initialTotalLines = 0;
    appendedSinceInit = 0;
    send(IPC.Rotated);
  });
  t.on('error', (err: TailerError) => {
    lastError = err;
    send(IPC.Error, err);
  });
}

async function startTailer(): Promise<InitialPayload> {
  if (startInflight) return startInflight;
  const promise = (async (): Promise<InitialPayload> => {
    if (!tailer) {
      tailer = new LogTailer(LOG_PATH);
      attachTailerEvents(tailer);
    }
    const { initial, totalLines, path, error } = await tailer.start();
    initialBuffer = initial;
    initialTotalLines = totalLines;
    appendedSinceInit = 0;
    lastError = error;
    return { path, lines: initial, totalLines, error };
  })();
  startInflight = promise;
  void promise.finally(() => {
    if (startInflight === promise) startInflight = null;
  });
  return promise;
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== MAIN_WINDOW_WEBPACK_ENTRY) event.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

ipcMain.handle(IPC.GetInitial, async (): Promise<InitialPayload> => {
  if (!tailer) {
    return startTailer();
  }
  return {
    path: LOG_PATH,
    lines: initialBuffer,
    totalLines: initialTotalLines + appendedSinceInit,
    error: lastError,
  };
});

ipcMain.handle(IPC.Retry, async (): Promise<InitialPayload> => {
  return startTailer();
});

ipcMain.handle(IPC.SettingsGet, (): Settings => settingsStore.get());

ipcMain.handle(
  IPC.SettingsSet,
  (_e, patch: Partial<Settings>): Promise<Settings> => settingsStore.set(patch),
);

const SHIM_TO_KEY: Record<string, AgentKey> = Object.fromEntries(
  AGENTS.map((a) => [a.shim, a.key]),
);
SHIM_TO_KEY['claude-code'] = 'claude';

function classifyAgent(value: unknown): AgentKey {
  if (typeof value !== 'string') return 'other';
  return SHIM_TO_KEY[value] ?? 'other';
}

function emptyAgents(): Record<AgentKey, AgentBreakdown> {
  const keys: AgentKey[] = [...AGENTS.map((a) => a.key), 'other'];
  return Object.fromEntries(
    keys.map((k) => [k, { total: 0, allowed: 0, denied: 0 }]),
  ) as Record<AgentKey, AgentBreakdown>;
}

ipcMain.handle(IPC.GetStats, async (): Promise<StatsPayload> => {
  const stats: StatsPayload = {
    total: 0,
    allowed: 0,
    denied: 0,
    agents: emptyAgents(),
    scannedAt: Date.now(),
  };
  try {
    const stream = createReadStream(LOG_PATH, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      stats.total += 1;
      let agent: AgentKey = 'other';
      let decision: 'allow' | 'deny' | null = null;
      try {
        const obj = JSON.parse(line) as { decision?: unknown; agent?: unknown };
        agent = classifyAgent(obj.agent);
        if (obj.decision === 'allow') decision = 'allow';
        else if (obj.decision === 'deny') decision = 'deny';
      } catch {
        /* unparseable line still counts toward total / agents.other.total */
      }
      const bucket = stats.agents[agent];
      bucket.total += 1;
      if (decision === 'allow') {
        stats.allowed += 1;
        bucket.allowed += 1;
      } else if (decision === 'deny') {
        stats.denied += 1;
        bucket.denied += 1;
      }
    }
    stats.scannedAt = Date.now();
  } catch {
    /* file missing or unreadable: return zeros */
  }
  return stats;
});

app.on('ready', async () => {
  await settingsStore.init();
  try {
    await startTailer();
  } catch {
    // errors surface via IPC
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  await tailer?.stop();
});
