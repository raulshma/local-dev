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

export interface AppSettings {
  ideCommand: string;
  terminalCommand?: string;
}

export interface AppStore {
  projects: Project[];
  settings: AppSettings;
  selectedProjectId: string | null;
}
