export interface ProjectSettings {
  ideCommand?: string;
  terminalCommand?: string;
  environmentConfig?: EnvironmentConfigMetadata;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  scripts: ProjectScript[];
  createdAt: string;
  lastAccessed?: string;
  settings?: ProjectSettings;
}

export interface ProjectScript {
  id: string;
  name: string;
  command: string;
  isAutoDetected?: boolean;
  projectType?: string;
}

export interface ScriptOutput {
  projectId: string;
  scriptId: string;
  type: 'stdout' | 'stderr';
  data: string;
}

export interface ScriptExecutionHistory {
  id: string;
  projectId: string;
  scriptId: string;
  scriptName: string;
  command: string;
  startTime: string;
  endTime?: string;
  duration?: number; // in milliseconds
  exitCode?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  error?: string;
}

export interface ScriptStatus {
  projectId: string;
  scriptId: string;
  status: 'running' | 'stopped' | 'error';
  exitCode?: number;
  error?: string;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  isNew?: boolean;
}

export interface EnvironmentConfig {
  variables: Record<string, string>;
  exists: boolean;
  originalContent?: string;
}

export interface EnvironmentConfiguration {
  id: string;
  name: string;
  filename: string; // e.g., '.env', '.env.dev', '.env.production'
  displayName: string; // e.g., 'Development', 'Production', 'Staging'
  template?: string; // Template type used to create this config
  variables: Record<string, string>;
  exists: boolean;
  isActive?: boolean; // Currently selected configuration
  lastModified?: string;
}

export interface EnvironmentConfigMetadata {
  activeConfigId?: string;
  configurations: EnvironmentConfiguration[];
}

export interface AppSettings {
  // General settings
  startupBehavior?: 'last-state' | 'empty' | 'dashboard';
  autoUpdate?: boolean;
  checkForUpdatesOnStartup?: boolean;

  // Appearance settings
  theme?: 'light' | 'dark' | 'auto' | 'high-contrast';
  fontSize?: 'small' | 'medium' | 'large';
  compactMode?: boolean;

  // Integration settings
  ideCommand: string;
  terminalCommand?: string;
  gitClientCommand?: string;

  // Performance settings
  maxBackgroundProcesses?: number;
  enableFileWatching?: boolean;
  cacheSize?: number;

  // Security settings
  restrictProjectPaths?: boolean;
  allowedPaths?: string[];
  enableSafeMode?: boolean;

  // Notification settings
  notifications?: {
    scriptEvents?: boolean;
    projectEvents?: boolean;
    systemEvents?: boolean;
    scriptCompletion?: boolean;
    scriptErrors?: boolean;
    scriptWarnings?: boolean;
    minimizeToTray?: boolean;
  };

  // Background operation settings
  backgroundOperation?: {
    enableMinimalMode?: boolean;
    continueBackgroundTasks?: boolean;
    backgroundTaskLimit?: number;
    resourceLimitCpuPercent?: number;
    resourceLimitMemoryMb?: number;
    gitPollingInterval?: number; // in seconds
    fileWatchingThrottle?: number; // in milliseconds
  };
}

export interface AppStore {
  projects: Project[];
  settings: AppSettings;
  selectedProjectId: string | null;
}

export interface ProjectType {
  type: string;
  confidence: number;
  indicators: string[];
}

export interface DetectedScript {
  name: string;
  command: string;
  projectType: string;
  priority: number;
}

// Git Integration Types
export interface GitStatus {
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
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream?: string;
  lastCommit?: string;
  lastCommitDate?: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

export interface GitChangedFile {
  path: string;
  status: string; // 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' but service returns string
  staged: boolean;
}

export interface GitStash {
  index: number;
  name: string;
  message: string;
  date: string;
}

export interface DockerConfiguration {
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasDockerIgnore: boolean;
  dockerComposeFiles: string[];
  dockerfileLocation?: string;
}

export interface DockerContainer {
  id: string;
  image: string;
  command: string;
  created: string;
  status: string;
  ports: string;
  name: string;
}

export interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  created: string;
  size: string;
}

export interface DockerScript {
  id: string;
  name: string;
  command: string;
  type: 'build' | 'run' | 'compose-up' | 'compose-down' | 'logs' | 'stop';
  isAutoDetected: boolean;
}

// Terminal types
export interface TerminalOptions {
  id: string;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface TerminalData {
  id: string;
  data: string;
}

export interface TerminalInfo {
  id: string;
  shell: string;
  cwd: string;
  isActive: boolean;
}
