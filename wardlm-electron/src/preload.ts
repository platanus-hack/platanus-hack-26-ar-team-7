import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC, LogErrorPayload, InitialPayload, WardlmApi } from './shared';

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
  retry: (): Promise<InitialPayload> => ipcRenderer.invoke(IPC.Retry),
  onLine: (cb) => subscribe<string>(IPC.Line, cb),
  onRotated: (cb) => subscribe<void>(IPC.Rotated, () => cb()),
  onError: (cb) => subscribe<LogErrorPayload>(IPC.Error, cb),
};

contextBridge.exposeInMainWorld('wardlm', api);
