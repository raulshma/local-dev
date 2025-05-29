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
  isAutoDetected?: boolean;
  projectType?: string;
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
  | 'project:get-settings'
  | 'project:update-settings'
  | 'project:detect-type'
  | 'project:detect-scripts'
  | 'project:refresh-auto-scripts'
  | 'project:start-dev'
  | 'script:execute'
  | 'script:stop'
  | 'script:output'
  | 'script:is-running'
  | 'env:load'
  | 'env:save'
  | 'env:backup'
  | 'action:open-ide'
  | 'action:open-folder'
  | 'action:open-terminal'
  | 'settings:get'
  | 'settings:update'
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
    getSettings: (projectId: string) => 
      ipcRenderer.invoke('project:get-settings', projectId) as Promise<{
        success: boolean;
        projectSettings?: { ideCommand?: string; terminalCommand?: string };
        effectiveSettings?: { ideCommand: string; terminalCommand?: string };
        error?: string;
      }>,
    updateSettings: (projectId: string, settings: Partial<{ ideCommand: string; terminalCommand: string }>) => 
      ipcRenderer.invoke('project:update-settings', projectId, settings) as Promise<{
        success: boolean;
        error?: string;
      }>,
    // Project detection
    detectType: (projectPath: string) => 
      ipcRenderer.invoke('project:detect-type', projectPath) as Promise<{
        success: boolean;
        types?: Array<{ type: string; confidence: number; indicators: string[] }>;
        error?: string;
      }>,
    detectScripts: (projectId: string) => 
      ipcRenderer.invoke('project:detect-scripts', projectId) as Promise<{
        success: boolean;
        scripts?: Array<{ name: string; command: string; projectType: string; priority: number }>;
        types?: Array<{ type: string; confidence: number; indicators: string[] }>;
        error?: string;
      }>,
    refreshAutoScripts: (projectId: string) => 
      ipcRenderer.invoke('project:refresh-auto-scripts', projectId) as Promise<{
        success: boolean;
        scripts?: Array<{ name: string; command: string; projectType: string; priority: number }>;
        types?: Array<{ type: string; confidence: number; indicators: string[] }>;
        error?: string;
      }>,
    startDev: (projectId: string) => 
      ipcRenderer.invoke('project:start-dev', projectId) as Promise<{
        success: boolean;
        command?: string;
        projectType?: string;
        pid?: number;
        error?: string;
      }>,
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
  // Environment variables
  env: {
    load: (projectId: string) => 
      ipcRenderer.invoke('env:load', projectId) as Promise<{
        success: boolean;
        exists?: boolean;
        variables?: Record<string, string>;
        originalContent?: string;
        error?: string;
      }>,
    save: (projectId: string, variables: Record<string, string>) => 
      ipcRenderer.invoke('env:save', projectId, variables) as Promise<{
        success: boolean;
        error?: string;
      }>,
    backup: (projectId: string) => 
      ipcRenderer.invoke('env:backup', projectId) as Promise<{
        success: boolean;
        backupPath?: string;
        error?: string;
      }>,
  },
  // Dialog utilities
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder') as Promise<string | null>,
  },
  // Quick actions
  actions: {
    openIDE: (projectId: string) => 
      ipcRenderer.invoke('action:open-ide', projectId) as Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>,
    openFolder: (projectId: string) => 
      ipcRenderer.invoke('action:open-folder', projectId) as Promise<{
        success: boolean;
        error?: string;
      }>,
    openTerminal: (projectId: string) => 
      ipcRenderer.invoke('action:open-terminal', projectId) as Promise<{
        success: boolean;
        error?: string;
      }>,
  },
  // Settings
  settings: {
    get: () => 
      ipcRenderer.invoke('settings:get') as Promise<{
        success: boolean;
        settings?: { ideCommand: string; terminalCommand?: string };
        error?: string;
      }>,
    update: (settings: Partial<{ ideCommand: string; terminalCommand?: string }>) => 
      ipcRenderer.invoke('settings:update', settings) as Promise<{
        success: boolean;
        error?: string;
      }>,
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
