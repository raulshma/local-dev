import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project } from '../../types';

interface AppContextType {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadProjects: () => Promise<void>;
  addProject: (name: string, path: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  selectProject: (id: string) => Promise<void>;
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

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
  }, []);

  const value: AppContextType = {
    projects,
    selectedProject,
    isLoading,
    error,
    loadProjects,
    addProject,
    removeProject,
    selectProject,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
