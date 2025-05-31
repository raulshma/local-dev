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
  | 'script:get-execution-history'
  | 'script:clear-execution-history'
  | 'env:load'
  | 'env:save'
  | 'env:backup'
  | 'env-config:load'
  | 'env-config:switch'
  | 'env-config:create'
  | 'env-config:save'
  | 'env-config:delete'
  | 'action:open-ide'
  | 'action:open-folder'
  | 'action:open-terminal'
  | 'settings:get'
  | 'settings:update'
  | 'dialog:select-folder'
  | 'git:check-repository'
  | 'git:get-status'
  | 'git:get-current-branch'
  | 'git:get-branches'
  | 'git:get-remote-status'
  | 'git:get-recent-commits'
  | 'git:switch-branch'
  | 'git:pull'
  | 'git:push'
  | 'git:stage-files'
  | 'git:commit'
  | 'git:get-diff'
  | 'git:get-changed-files'
  | 'git:create-stash'
  | 'git:get-stashes'
  | 'git:apply-stash'
  | 'git:drop-stash'
  | 'git:pop-stash'
  | 'docker:detect-configuration'
  | 'docker:generate-scripts'
  | 'docker:is-available'
  | 'docker:get-containers'
  | 'docker:get-images'
  | 'terminal:create'
  | 'terminal:write'
  | 'terminal:resize'
  | 'terminal:kill'
  | 'terminal:list'
  | 'terminal:execute'
  | 'terminal:cd'
  | 'terminal:info'
  | 'terminal:interrupt'
  | 'terminal:data'
  | 'terminal:exit'
  | 'terminal:error'
  | 'terminal:created'
  | 'terminal:closed';

const electronHandler = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
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
    getExecutionHistory: (projectId: string) =>
      ipcRenderer.invoke('script:get-execution-history', projectId),
    clearExecutionHistory: (projectId: string) =>
      ipcRenderer.invoke('script:clear-execution-history', projectId),
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
  // Environment configuration
  envConfig: {
    load: (projectId: string) =>
      ipcRenderer.invoke('env-config:load', projectId) as Promise<{
        success: boolean;
        metadata?: {
          activeConfigId?: string;
          configurations: Array<{
            id: string;
            name: string;
            filename: string;
            displayName: string;
            template?: string;
            variables: Record<string, string>;
            exists: boolean;
            isActive?: boolean;
            lastModified?: string;
          }>;
        };
        error?: string;
      }>,
    switch: (projectId: string, configId: string) =>
      ipcRenderer.invoke('env-config:switch', projectId, configId) as Promise<{
        success: boolean;
        error?: string;
      }>,
    create: (projectId: string, name: string, filename: string, template?: string) =>
      ipcRenderer.invoke('env-config:create', projectId, name, filename, template) as Promise<{
        success: boolean;
        configuration?: {
          id: string;
          name: string;
          filename: string;
          displayName: string;
          template?: string;
          variables: Record<string, string>;
          exists: boolean;
          lastModified?: string;
        };
        error?: string;
      }>,
    save: (projectId: string, configId: string, variables: Record<string, string>) =>
      ipcRenderer.invoke('env-config:save', projectId, configId, variables) as Promise<{
        success: boolean;
        error?: string;
      }>,
    remove: (projectId: string, configId: string) =>
      ipcRenderer.invoke('env-config:delete', projectId, configId) as Promise<{
        success: boolean;
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
  // Git integration
  git: {
    checkRepository: (projectId: string) =>
      ipcRenderer.invoke('git:check-repository', projectId) as Promise<{
        success: boolean;
        isRepository?: boolean;
        error?: string;
      }>,
    getStatus: (projectId: string) =>
      ipcRenderer.invoke('git:get-status', projectId) as Promise<{
        success: boolean;
        status?: {
          isRepository: boolean;
          currentBranch?: string;
          ahead: number;
          behind: number;
          staged: number;
          unstaged: number;
          untracked: number;
          clean: boolean;
          remoteUrl?: string;
          hasUncommittedChanges: boolean;
        };
        error?: string;
      }>,
    getCurrentBranch: (projectId: string) =>
      ipcRenderer.invoke('git:get-current-branch', projectId) as Promise<{
        success: boolean;
        branch?: string;
        error?: string;
      }>,
    getBranches: (projectId: string) =>
      ipcRenderer.invoke('git:get-branches', projectId) as Promise<{
        success: boolean;
        branches?: Array<{
          name: string;
          isCurrent: boolean;
          isRemote: boolean;
          ahead: number;
          behind: number;
        }>;
        error?: string;
      }>,
    getRemoteStatus: (projectId: string) =>
      ipcRenderer.invoke('git:get-remote-status', projectId) as Promise<{
        success: boolean;
        remoteStatus?: { ahead: number; behind: number };
        error?: string;
      }>,
    getRecentCommits: (projectId: string, limit?: number) =>
      ipcRenderer.invoke('git:get-recent-commits', projectId, limit) as Promise<{
        success: boolean;
        commits?: Array<{
          hash: string;
          shortHash: string;
          author: string;
          date: string;
          message: string;
          files: string[];
        }>;
        error?: string;
      }>,
    switchBranch: (projectId: string, branchName: string) =>
      ipcRenderer.invoke('git:switch-branch', projectId, branchName) as Promise<{
        success: boolean;
        error?: string;
      }>,
    pull: (projectId: string) =>
      ipcRenderer.invoke('git:pull', projectId) as Promise<{
        success: boolean;
        result?: { success: boolean; output?: string; error?: string };
        error?: string;
      }>,
    push: (projectId: string) =>
      ipcRenderer.invoke('git:push', projectId) as Promise<{
        success: boolean;
        result?: { success: boolean; output?: string; error?: string };
        error?: string;
      }>,
    stageFiles: (projectId: string, files: string[]) =>
      ipcRenderer.invoke('git:stage-files', projectId, files) as Promise<{
        success: boolean;
        result?: { success: boolean; error?: string };
        error?: string;
      }>,
    commit: (projectId: string, message: string) =>
      ipcRenderer.invoke('git:commit', projectId, message) as Promise<{
        success: boolean;
        result?: { success: boolean; output?: string; error?: string };
        error?: string;
      }>,
    getDiff: (projectId: string, filePath?: string) =>
      ipcRenderer.invoke('git:get-diff', projectId, filePath) as Promise<{
        success: boolean;
        diff?: string;
        error?: string;
      }>,
    getChangedFiles: (projectId: string) =>
      ipcRenderer.invoke('git:get-changed-files', projectId) as Promise<{
        success: boolean;
        files?: Array<{
          path: string;
          status: string;
          staged: boolean;
        }>;
        error?: string;
      }>,
    createStash: (projectId: string, message?: string) =>
      ipcRenderer.invoke('git:create-stash', projectId, message) as Promise<{
        success: boolean;
        error?: string;
      }>,
    getStashes: (projectId: string) =>
      ipcRenderer.invoke('git:get-stashes', projectId) as Promise<{
        success: boolean;
        stashes?: Array<{
          index: number;
          name: string;
          message: string;
          date: string;
        }>;
        error?: string;
      }>,
    applyStash: (projectId: string, stashIndex: number) =>
      ipcRenderer.invoke('git:apply-stash', projectId, stashIndex) as Promise<{
        success: boolean;
        error?: string;
      }>,
    dropStash: (projectId: string, stashIndex: number) =>
      ipcRenderer.invoke('git:drop-stash', projectId, stashIndex) as Promise<{
        success: boolean;
        error?: string;
      }>,
    popStash: (projectId: string) =>
      ipcRenderer.invoke('git:pop-stash', projectId) as Promise<{
        success: boolean;
        error?: string;
      }>,
  },
  // Docker Integration
  docker: {
    detectConfiguration: (projectId: string) =>
      ipcRenderer.invoke('docker:detect-configuration', projectId) as Promise<{
        success: boolean;
        config?: {
          hasDockerfile: boolean;
          hasDockerCompose: boolean;
          hasDockerIgnore: boolean;
          dockerComposeFiles: string[];
          dockerfileLocation?: string;
        };
        error?: string;
      }>,
    generateScripts: (projectId: string) =>
      ipcRenderer.invoke('docker:generate-scripts', projectId) as Promise<{
        success: boolean;
        scripts?: {
          id: string;
          name: string;
          command: string;
          type: 'build' | 'run' | 'compose-up' | 'compose-down' | 'logs' | 'stop';
          isAutoDetected: boolean;
        }[];
        error?: string;
      }>,
    isAvailable: () =>
      ipcRenderer.invoke('docker:is-available') as Promise<{
        success: boolean;
        isAvailable: boolean;
        error?: string;
      }>,
    getContainers: () =>
      ipcRenderer.invoke('docker:get-containers') as Promise<{
        success: boolean;
        containers: {
          id: string;
          image: string;
          command: string;
          created: string;
          status: string;
          ports: string;
          name: string;
        }[];
        error?: string;
      }>,
    getImages: () =>
      ipcRenderer.invoke('docker:get-images') as Promise<{
        success: boolean;
        images: {
          repository: string;
          tag: string;
          id: string;
          created: string;
          size: string;
        }[];
        error?: string;
      }>,
  },
  // Terminal management
  terminal: {
    create: (options: { id: string; shell?: string; cwd?: string; env?: Record<string, string>; cols?: number; rows?: number }) =>
      ipcRenderer.invoke('terminal:create', options) as Promise<{
        success: boolean;
        error?: string;
      }>,
    write: (id: string, data: string) =>
      ipcRenderer.invoke('terminal:write', id, data) as Promise<{
        success: boolean;
        error?: string;
      }>,
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows) as Promise<{
        success: boolean;
        error?: string;
      }>,
    kill: (id: string) =>
      ipcRenderer.invoke('terminal:kill', id) as Promise<{
        success: boolean;
        error?: string;
      }>,
    list: () =>
      ipcRenderer.invoke('terminal:list') as Promise<{
        success: boolean;
        terminals?: { id: string; shell: string; cwd: string; isActive: boolean }[];
        error?: string;
      }>,
    execute: (id: string, command: string) =>
      ipcRenderer.invoke('terminal:execute', id, command) as Promise<{
        success: boolean;
        error?: string;
      }>,
    cd: (id: string, directory: string) =>
      ipcRenderer.invoke('terminal:cd', id, directory) as Promise<{
        success: boolean;
        error?: string;
      }>,
    interrupt: (id: string) =>
      ipcRenderer.invoke('terminal:interrupt', id) as Promise<{
        success: boolean;
        error?: string;
      }>,
    info: (id: string) =>
      ipcRenderer.invoke('terminal:info', id) as Promise<{
        success: boolean;
        info?: { id: string; shell: string; cwd: string; isActive: boolean };
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
