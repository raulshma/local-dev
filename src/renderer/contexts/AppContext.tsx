import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project, ProjectScript, ScriptOutput, ScriptStatus } from '../../types';

interface AppContextType {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  runningScripts: Set<string>;
  scriptOutput: { [scriptId: string]: { output: string; isVisible: boolean } };
  
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
  const [scriptOutput, setScriptOutput] = useState<{ [scriptId: string]: { output: string; isVisible: boolean } }>({});

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
      await loadProjects(); // Reload projects list
      // Clear selection if we removed the selected project
      if (selectedProject?.id === id) {
        setSelectedProject(null);
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
      await window.electron.script.stop(projectId, scriptId);
      setRunningScripts(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${projectId}:${scriptId}`);
        return newSet;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
      } else {
        setRunningScripts(prev => {
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
  }, []);

  const value: AppContextType = {
    projects,
    selectedProject,
    isLoading,
    error,
    runningScripts,
    scriptOutput,
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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
