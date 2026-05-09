import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { LogTailer, DEFAULT_LOG_PATH, TailerError } from './tailer';
import { IPC, InitialPayload, StatsPayload } from './shared';

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
    send(IPC.Line, line);
  });
  t.on('rotated', () => {
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
    const { initial, path, error } = await tailer.start();
    initialBuffer = initial;
    lastError = error;
    return { path, lines: initial, error };
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
  return { path: LOG_PATH, lines: initialBuffer, error: lastError };
});

ipcMain.handle(IPC.Retry, async (): Promise<InitialPayload> => {
  return startTailer();
});

ipcMain.handle(IPC.GetStats, async (): Promise<StatsPayload> => {
  const stats: StatsPayload = {
    total: 0,
    allowed: 0,
    denied: 0,
    scannedAt: Date.now(),
  };
  try {
    const stream = createReadStream(LOG_PATH, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      stats.total += 1;
      try {
        const obj = JSON.parse(line) as { decision?: unknown };
        if (obj.decision === 'allow') stats.allowed += 1;
        else if (obj.decision === 'deny') stats.denied += 1;
      } catch {
        /* unparseable line still counts toward total */
      }
    }
    stats.scannedAt = Date.now();
  } catch {
    /* file missing or unreadable: return zeros */
  }
  return stats;
});

app.on('ready', async () => {
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
