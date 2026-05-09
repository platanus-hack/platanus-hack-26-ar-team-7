import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  IPC,
  LogErrorPayload,
  InitialPayload,
  Settings,
  StatsPayload,
  WardlmApi,
} from './shared';

const subscribe = <T>(
  channel: string,
  cb: (payload: T) => void,
): (() => void) => {
  const handler = (_e: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const api: WardlmApi = {
  getInitial: (): Promise<InitialPayload> => ipcRenderer.invoke(IPC.GetInitial),
  getStats: (): Promise<StatsPayload> => ipcRenderer.invoke(IPC.GetStats),
  retry: (): Promise<InitialPayload> => ipcRenderer.invoke(IPC.Retry),
  onLine: (cb) => subscribe<string>(IPC.Line, cb),
  onRotated: (cb) => subscribe<void>(IPC.Rotated, () => cb()),
  onError: (cb) => subscribe<LogErrorPayload>(IPC.Error, cb),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.SettingsGet),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SettingsSet, patch),
};

contextBridge.exposeInMainWorld('wardlm', api);
