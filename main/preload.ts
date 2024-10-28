import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Exposed Electron API
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data?: unknown) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel: string, func: (...args: unknown[]) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    invoke: async (channel: string, ...args: unknown[]): Promise<unknown> => {
      return await ipcRenderer.invoke(channel, ...args);
    }
  }
});

// Type definitions
export type ElectronAPI = {
  ipcRenderer: {
    send: (channel: string, data?: unknown) => void;
    on: (channel: string, func: (...args: unknown[]) => void) => () => void;
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  },
};

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}