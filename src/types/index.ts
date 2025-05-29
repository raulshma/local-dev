export interface ProjectSettings {
  ideCommand?: string;
  terminalCommand?: string;
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
