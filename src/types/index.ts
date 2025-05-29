export interface Project {
  id: string;
  name: string;
  path: string;
  scripts: ProjectScript[];
  createdAt: string;
  lastAccessed?: string;
}

export interface ProjectScript {
  id: string;
  name: string;
  command: string;
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
