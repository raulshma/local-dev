import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, ProjectScript, ScriptOutput, ScriptStatus, EnvironmentConfig } from '../../types';

interface AppContextType {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  runningScripts: Set<string>;
  stoppingScripts: Set<string>;
  scriptOutput: { [scriptId: string]: { output: string; isVisible: boolean } };
  environmentConfig: EnvironmentConfig | null;
  environmentLoading: boolean;

  // Actions
  loadProjects: () => Promise<void>;
  addProject: (name: string, path: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  selectProject: (id: string) => Promise<void>;

  // Script actions
  addScript: (projectId: string, script: { name: string; command: string }) => Promise<void>;
  removeScript: (projectId: string, scriptId: string) => Promise<void>;
  updateScript: (projectId: string, script: ProjectScript) => Promise<void>;
  executeScript: (projectId: string, scriptId: string) => Promise<void>;
  stopScript: (projectId: string, scriptId: string) => Promise<void>;
  clearScriptOutput: (scriptId: string) => void;
  toggleScriptOutput: (scriptId: string) => void;
    // Environment actions
  loadEnvironment: (projectId: string) => Promise<void>;
  saveEnvironment: (projectId: string, variables: Record<string, string>) => Promise<void>;
  backupEnvironment: (projectId: string) => Promise<void>;
    // Quick actions
  openInIDE: (projectId: string) => Promise<void>;
  openFolder: (projectId: string) => Promise<void>;
  openInTerminal: (projectId: string) => Promise<void>;

  // Project settings
  loadProjectSettings: (projectId: string) => Promise<{ projectSettings: any; effectiveSettings: any } | null>;
  saveProjectSettings: (projectId: string, settings: Partial<{ ideCommand: string; terminalCommand: string }>) => Promise<void>;

  // Project detection and auto features
  refreshAutoScripts: (projectId: string) => Promise<void>;
  startDevServer: (projectId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningScripts, setRunningScripts] = useState<Set<string>>(new Set());
  const [stoppingScripts, setStoppingScripts] = useState<Set<string>>(new Set());
  const [scriptOutput, setScriptOutput] = useState<{ [scriptId: string]: { output: string; isVisible: boolean } }>({});
  const [environmentConfig, setEnvironmentConfig] = useState<EnvironmentConfig | null>(null);
  const [environmentLoading, setEnvironmentLoading] = useState(false);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const projects = await window.electron.project.list();
      setProjects(projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const addProject = async (name: string, path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electron.project.add(name, path);
      await loadProjects(); // Reload projects list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const removeProject = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electron.project.remove(id);
      await loadProjects(); // Reload projects list      // Clear selection if we removed the selected project
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        setEnvironmentConfig(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  const selectProject = async (id: string) => {
    setError(null);

    try {
      await window.electron.project.select(id);
      const project = projects.find(p => p.id === id);
      if (project) {
        setSelectedProject(project);
        // Clear environment config when switching projects
        setEnvironmentConfig(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const addScript = async (projectId: string, script: { name: string; command: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electron.project.addScript(projectId, script);
      await loadProjects(); // Reload to get updated project with new script
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const removeScript = async (projectId: string, scriptId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electron.project.removeScript(projectId, scriptId);
      await loadProjects(); // Reload to get updated project
      // Clear script output if it exists
      setScriptOutput(prev => {
        const newOutput = { ...prev };
        delete newOutput[scriptId];
        return newOutput;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const updateScript = async (projectId: string, script: ProjectScript) => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electron.project.updateScript(projectId, script);
      await loadProjects(); // Reload to get updated project
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const executeScript = async (projectId: string, scriptId: string) => {
    setError(null);

    try {
      await window.electron.script.execute(projectId, scriptId);
      setRunningScripts(prev => new Set(prev).add(`${projectId}:${scriptId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const stopScript = async (projectId: string, scriptId: string) => {
    setError(null);

    try {
      // Add to stopping scripts immediately for UI feedback
      setStoppingScripts(prev => {
        const newSet = new Set(prev);
        newSet.add(`${projectId}:${scriptId}`);
        return newSet;
      });

      await window.electron.script.stop(projectId, scriptId);

      // Remove from running and stopping scripts
      setRunningScripts(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${projectId}:${scriptId}`);
        return newSet;
      });

      setStoppingScripts(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${projectId}:${scriptId}`);
        return newSet;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Remove from stopping scripts on error
      setStoppingScripts(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${projectId}:${scriptId}`);
        return newSet;
      });
    }
  };

  const clearScriptOutput = (scriptId: string) => {
    setScriptOutput(prev => ({
      ...prev,
      [scriptId]: { output: '', isVisible: prev[scriptId]?.isVisible ?? false }
    }));
  };

  const toggleScriptOutput = (scriptId: string) => {
    setScriptOutput(prev => ({
      ...prev,
      [scriptId]: {
        output: prev[scriptId]?.output ?? '',
        isVisible: !prev[scriptId]?.isVisible
      }
    }));
  };

  // Set up script output and status listeners
  useEffect(() => {
    const handleScriptOutput = (data: ScriptOutput) => {
      setScriptOutput(prev => ({
        ...prev,
        [data.scriptId]: {
          output: (prev[data.scriptId]?.output ?? '') + data.data,
          isVisible: prev[data.scriptId]?.isVisible ?? false
        }
      }));
    };

    const handleScriptStatus = (data: ScriptStatus) => {
      const processKey = `${data.projectId}:${data.scriptId}`;

      if (data.status === 'running') {
        setRunningScripts(prev => new Set(prev).add(processKey));
        // Remove from stopping scripts if it was being stopped
        setStoppingScripts(prev => {
          const newSet = new Set(prev);
          newSet.delete(processKey);
          return newSet;
        });
      } else {
        setRunningScripts(prev => {
          const newSet = new Set(prev);
          newSet.delete(processKey);
          return newSet;
        });
        // Remove from stopping scripts when process actually stops
        setStoppingScripts(prev => {
          const newSet = new Set(prev);
          newSet.delete(processKey);
          return newSet;
        });
      }

      if (data.status === 'stopped') {
        const exitMessage = `\n[Process exited with code ${data.exitCode ?? 0}]\n`;
        setScriptOutput(prev => ({
          ...prev,
          [data.scriptId]: {
            output: (prev[data.scriptId]?.output ?? '') + exitMessage,
            isVisible: prev[data.scriptId]?.isVisible ?? false
          }
        }));
      } else if (data.status === 'error') {
        const errorMessage = `\n[Error: ${data.error}]\n`;
        setScriptOutput(prev => ({
          ...prev,
          [data.scriptId]: {
            output: (prev[data.scriptId]?.output ?? '') + errorMessage,
            isVisible: prev[data.scriptId]?.isVisible ?? false
          }
        }));
      }
    };

    window.electron.script.onOutput(handleScriptOutput);
    window.electron.script.onStatus(handleScriptStatus);

    return () => {
      window.electron.script.removeOutputListener();
      window.electron.script.removeStatusListener();
    };
  }, []);

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
  }, []);  // Environment methods
  const loadEnvironment = useCallback(async (projectId: string) => {
    setEnvironmentLoading(true);
    setError(null);

    try {
      const result = await window.electron.env.load(projectId);
      if (result.success) {
        setEnvironmentConfig({
          variables: result.variables || {},
          exists: result.exists || false,
          originalContent: result.originalContent
        });
      } else {
        setError(result.error || 'Failed to load environment variables');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEnvironmentLoading(false);
    }
  }, []);

  const saveEnvironment = useCallback(async (projectId: string, variables: Record<string, string>) => {
    setEnvironmentLoading(true);
    setError(null);

    try {
      const result = await window.electron.env.save(projectId, variables);
      if (result.success) {
        // Update local state with saved variables
        setEnvironmentConfig(prev => prev ? {
          ...prev,
          variables
        } : {
          variables,
          exists: true
        });
      } else {
        setError(result.error || 'Failed to save environment variables');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEnvironmentLoading(false);
    }
  }, []);
  const backupEnvironment = useCallback(async (projectId: string) => {
    setEnvironmentLoading(true);
    setError(null);

    try {
      const result = await window.electron.env.backup(projectId);
      if (!result.success) {
        setError(result.error || 'Failed to backup environment variables');
      }
      // Note: We could show a success message with the backup path if needed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEnvironmentLoading(false);
    }
  }, []);
  // Quick actions
  const openInIDE = useCallback(async (projectId: string) => {
    setError(null);

    try {
      const result = await window.electron.actions.openIDE(projectId);
      if (!result.success) {
        setError(result.error || 'Failed to open project in IDE');
      } else if (result.message) {
        // Show success message if an alternative IDE was used
        console.info('IDE opened:', result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const openFolder = useCallback(async (projectId: string) => {
    setError(null);

    try {
      const result = await window.electron.actions.openFolder(projectId);
      if (!result.success) {
        setError(result.error || 'Failed to open project folder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const openInTerminal = useCallback(async (projectId: string) => {
    setError(null);

    try {
      const result = await window.electron.actions.openTerminal(projectId);
      if (!result.success) {
        setError(result.error || 'Failed to open project in terminal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);  // Project settings
  const loadProjectSettings = useCallback(async (projectId: string) => {
    setError(null);

    try {
      const result = await window.electron.project.getSettings(projectId);
      if (!result.success) {
        setError(result.error || 'Failed to load project settings');
        return null;
      }
      return {
        projectSettings: result.projectSettings || {},
        effectiveSettings: result.effectiveSettings || {}
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);
  const saveProjectSettings = useCallback(async (projectId: string, settings: Partial<{ ideCommand: string; terminalCommand: string }>) => {
    setError(null);

    try {
      const result = await window.electron.project.updateSettings(projectId, settings);
      if (!result.success) {
        setError(result.error || 'Failed to save project settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Project detection and auto features
  const refreshAutoScripts = useCallback(async (projectId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.project.refreshAutoScripts(projectId);
      if (result.success) {
        await loadProjects(); // Reload to get updated scripts
      } else {
        setError(result.error || 'Failed to refresh auto-detected scripts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [loadProjects]);

  const startDevServer = useCallback(async (projectId: string) => {
    setError(null);

    try {
      const result = await window.electron.project.startDev(projectId);
      if (result.success) {
        // Add to running scripts for UI feedback
        setRunningScripts(prev => new Set(prev).add(`${projectId}:auto-dev`));

        // Show success message with detected command
        console.log(`Started dev server: ${result.command} (${result.projectType})`);
      } else {
        setError(result.error || 'Failed to start development server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);
  const value: AppContextType = {
    projects,
    selectedProject,
    isLoading,
    error,
    runningScripts,
    stoppingScripts,
    scriptOutput,
    environmentConfig,
    environmentLoading,
    loadProjects,
    addProject,
    removeProject,
    selectProject,
    addScript,
    removeScript,
    updateScript,
    executeScript,
    stopScript,
    clearScriptOutput,
    toggleScriptOutput,
    loadEnvironment,
    saveEnvironment,
    backupEnvironment,
    openInIDE,
    openFolder,
    openInTerminal,
    loadProjectSettings,
    saveProjectSettings,
    refreshAutoScripts,
    startDevServer,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
