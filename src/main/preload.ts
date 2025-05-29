// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define types locally to avoid import issues
interface Project {
  id: string;
  name: string;
  path: string;
  scripts: ProjectScript[];
  createdAt: string;
  lastAccessed?: string;
}

interface ProjectScript {
  id: string;
  name: string;
  command: string;
}

export type Channels = 
  | 'ipc-example'
  | 'project:add'
  | 'project:remove'
  | 'project:list'
  | 'project:select'
  | 'project:add-script'
  | 'project:remove-script'
  | 'project:update-script'
  | 'script:execute'
  | 'script:stop'
  | 'script:output'
  | 'env:load'
  | 'env:save'
  | 'action:open-ide'
  | 'action:open-folder'
  | 'action:open-terminal'
  | 'dialog:select-folder';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke: (channel: Channels, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  },
  // Project management
  project: {
    add: (name: string, path: string) => ipcRenderer.invoke('project:add', name, path),
    remove: (id: string) => ipcRenderer.invoke('project:remove', id),
    list: () => ipcRenderer.invoke('project:list') as Promise<Project[]>,
    select: (id: string) => ipcRenderer.invoke('project:select', id),
    addScript: (projectId: string, script: Omit<ProjectScript, 'id'>) => 
      ipcRenderer.invoke('project:add-script', projectId, script),
    removeScript: (projectId: string, scriptId: string) => 
      ipcRenderer.invoke('project:remove-script', projectId, scriptId),
    updateScript: (projectId: string, script: ProjectScript) => 
      ipcRenderer.invoke('project:update-script', projectId, script),
  },
  // Script execution
  script: {
    execute: (projectId: string, scriptId: string) => 
      ipcRenderer.invoke('script:execute', projectId, scriptId),
    stop: (projectId: string, scriptId: string) => 
      ipcRenderer.invoke('script:stop', projectId, scriptId),
    isRunning: (projectId: string, scriptId: string) => 
      ipcRenderer.invoke('script:is-running', projectId, scriptId) as Promise<boolean>,
    onOutput: (callback: (data: { projectId: string; scriptId: string; type: 'stdout' | 'stderr'; data: string }) => void) => {
      ipcRenderer.on('script:output', (_event, data) => callback(data));
    },
    onStatus: (callback: (data: { projectId: string; scriptId: string; status: 'running' | 'stopped' | 'error'; exitCode?: number; error?: string }) => void) => {
      ipcRenderer.on('script:status', (_event, data) => callback(data));
    },
    removeOutputListener: () => {
      ipcRenderer.removeAllListeners('script:output');
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners('script:status');
    },
  },
  // Dialog utilities
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder') as Promise<string | null>,
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
