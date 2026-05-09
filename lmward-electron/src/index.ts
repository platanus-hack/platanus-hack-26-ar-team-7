import { app, BrowserWindow, ipcMain } from 'electron';
import { LogTailer, DEFAULT_LOG_PATH, TailerError } from './tailer';
import { IPC, InitialPayload } from './shared';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const LOG_PATH = process.env.LMWRAP_LOG_PATH || DEFAULT_LOG_PATH;

let mainWindow: BrowserWindow | null = null;
let tailer: LogTailer | null = null;
let initialBuffer: string[] = [];
let lastError: TailerError | null = null;

function send(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function attachTailerEvents(t: LogTailer): void {
  t.on('line', (line: string) => send(IPC.Line, line));
  t.on('rotated', () => send(IPC.Rotated));
  t.on('error', (err: TailerError) => {
    lastError = err;
    send(IPC.Error, err);
  });
}

async function startTailer(): Promise<InitialPayload> {
  if (!tailer) {
    tailer = new LogTailer(LOG_PATH);
    attachTailerEvents(tailer);
  }
  lastError = null;
  const { initial, path } = await tailer.start();
  initialBuffer = initial;
  return { path, lines: initial };
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (lastError) send(IPC.Error, lastError);
  });
};

ipcMain.handle(IPC.GetInitial, async (): Promise<InitialPayload> => {
  if (!tailer) {
    return startTailer();
  }
  return { path: LOG_PATH, lines: initialBuffer };
});

ipcMain.handle(IPC.Retry, async (): Promise<void> => {
  await startTailer();
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
