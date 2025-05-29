import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectScript, AppStore, AppSettings, ProjectSettings, DetectedScript } from '../types';

class StoreService {
  private store: Store<AppStore>;

  constructor() {
    this.store = new Store<AppStore>({      defaults: {
        projects: [],
        settings: {
          ideCommand: 'cursor', // Default to Cursor since it's mentioned in the error
        },
        selectedProjectId: null,
      },
    });
  }

  // Project management
  getProjects(): Project[] {
    return this.store.get('projects', []);
  }

  addProject(name: string, path: string): Project {
    const projects = this.getProjects();
    const newProject: Project = {
      id: uuidv4(),
      name,
      path,
      scripts: [],
      createdAt: new Date().toISOString(),
    };
    
    projects.push(newProject);
    this.store.set('projects', projects);
    return newProject;
  }

  removeProject(id: string): boolean {
    const projects = this.getProjects();
    const filteredProjects = projects.filter(p => p.id !== id);
    
    if (filteredProjects.length !== projects.length) {
      this.store.set('projects', filteredProjects);
      
      // Clear selection if removing selected project
      if (this.getSelectedProjectId() === id) {
        this.setSelectedProjectId(null);
      }
      return true;
    }
    return false;
  }

  getProject(id: string): Project | undefined {
    const projects = this.getProjects();
    return projects.find(p => p.id === id);
  }

  updateProject(updatedProject: Project): boolean {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === updatedProject.id);
    
    if (index !== -1) {
      projects[index] = updatedProject;
      this.store.set('projects', projects);
      return true;
    }
    return false;
  }

  // Project selection
  getSelectedProjectId(): string | null {
    return this.store.get('selectedProjectId', null);
  }

  setSelectedProjectId(id: string | null): void {
    this.store.set('selectedProjectId', id);
    
    // Update last accessed time
    if (id) {
      const project = this.getProject(id);
      if (project) {
        project.lastAccessed = new Date().toISOString();
        this.updateProject(project);
      }
    }
  }
  // Script management
  addScript(projectId: string, script: Omit<ProjectScript, 'id'>): ProjectScript | null {
    const project = this.getProject(projectId);
    if (!project) return null;

    const newScript: ProjectScript = {
      id: uuidv4(),
      ...script,
    };

    project.scripts.push(newScript);
    this.updateProject(project);
    return newScript;
  }

  // Add auto-detected scripts to a project
  addAutoDetectedScripts(projectId: string, detectedScripts: DetectedScript[]): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    // Remove existing auto-detected scripts to avoid duplicates
    project.scripts = project.scripts.filter(script => !script.isAutoDetected);

    // Add new auto-detected scripts
    const autoScripts: ProjectScript[] = detectedScripts.map(script => ({
      id: uuidv4(),
      name: script.name,
      command: script.command,
      isAutoDetected: true,
      projectType: script.projectType
    }));

    project.scripts.push(...autoScripts);
    this.updateProject(project);
    return true;
  }
  getScript(projectId: string, scriptId: string): ProjectScript | null {
    const project = this.getProject(projectId);
    if (!project) return null;
    
    return project.scripts.find((s: ProjectScript) => s.id === scriptId) || null;
  }
  removeScript(projectId: string, scriptId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    const initialLength = project.scripts.length;
    project.scripts = project.scripts.filter((s: ProjectScript) => s.id !== scriptId);
    
    if (project.scripts.length !== initialLength) {
      this.updateProject(project);
      return true;
    }
    return false;
  }
  updateScript(projectId: string, updatedScript: ProjectScript): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    const index = project.scripts.findIndex((s: ProjectScript) => s.id === updatedScript.id);
    if (index !== -1) {
      project.scripts[index] = updatedScript;
      this.updateProject(project);
      return true;
    }
    return false;
  }

  // Settings
  getSettings(): AppSettings {
    return this.store.get('settings', {
      ideCommand: 'code',
    });
  }

  updateSettings(settings: Partial<AppSettings>): void {
    const currentSettings = this.getSettings();
    this.store.set('settings', { ...currentSettings, ...settings });
  }

  // Project-specific settings
  getProjectSettings(projectId: string): ProjectSettings {
    const project = this.getProject(projectId);
    return project?.settings || {};
  }

  updateProjectSettings(projectId: string, settings: Partial<ProjectSettings>): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    project.settings = { ...project.settings, ...settings };
    return this.updateProject(project);
  }

  // Get effective settings (project-specific with fallback to global)
  getEffectiveSettings(projectId: string): { ideCommand: string; terminalCommand?: string } {
    const projectSettings = this.getProjectSettings(projectId);
    const globalSettings = this.getSettings();
    
    return {
      ideCommand: projectSettings.ideCommand || globalSettings.ideCommand || 'code',
      terminalCommand: projectSettings.terminalCommand || globalSettings.terminalCommand,
    };
  }
}

export default StoreService;
