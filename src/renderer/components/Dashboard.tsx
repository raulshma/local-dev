import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../../types';
import ScriptsTab from './ScriptsTab';
import { EnvironmentTab } from './EnvironmentTab';
import ProjectSettingsTab from './ProjectSettingsTab';
import SettingsPage from './SettingsPage';
import { 
  FolderIcon, 
  CodeIcon, 
  TerminalIcon, 
  PlayIcon, 
  PlusIcon, 
  CloseIcon,
  ChevronDownIcon,
  SettingsIcon
} from './Icons';
import './Dashboard.css';

const Dashboard: React.FC = () => {  const { 
    projects, 
    selectedProject, 
    isLoading, 
    error, 
    addProject, 
    removeProject, 
    selectProject,
    addScript,
    removeScript,
    updateScript,
    executeScript,
    stopScript,
    openInIDE,
    openFolder,
    openInTerminal,
    startDevServer,
    refreshAutoScripts
  } = useApp();  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    
    const selectedPath = await window.electron.dialog.selectFolder();
    if (selectedPath) {
      await addProject(newProjectName.trim(), selectedPath);
      setNewProjectName('');
      setShowAddModal(false);
    }
  };

  const handleRemoveProject = async (project: Project) => {
    if (window.confirm(`Are you sure you want to remove "${project.name}" from the dashboard?`)) {
      await removeProject(project.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          Loading projects...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Title Bar */}
      <div className="title-bar">
        <div className="title-bar-content">
          <span className="app-name">Local Dev Environment</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          Error: {error}
        </div>
      )}

      {/* Main Layout */}
      <div className="dashboard-main">        {/* Activity Bar */}
        <div className="activity-bar">
          <div className="activity-bar-item active" title="Explorer">
            <div className="activity-bar-icon">
              <FolderIcon size={20} />
            </div>
          </div>
          <div className="activity-bar-item" title="Search">
            <div className="activity-bar-icon">�</div>
          </div>
          <div className="activity-bar-item" title="Source Control">
            <div className="activity-bar-icon">🌿</div>
          </div>
          <div className="activity-bar-item" title="Run and Debug">
            <div className="activity-bar-icon">🐛</div>
          </div>
          <div className="activity-bar-item" title="Extensions">
            <div className="activity-bar-icon">📦</div>
          </div>
        </div>        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <span>Explorer</span>
            <button 
              className="settings-btn"
              onClick={() => setShowSettingsPage(true)}
              title="Settings"
            >
              <SettingsIcon size={16} />
            </button>
          </div>
          <div className="sidebar-content">            <div className="sidebar-section">
              <div className="section-header">
                <span className="section-header-icon">
                  <ChevronDownIcon size={12} />
                </span>
                Projects
              </div>
              <div className="section-content">
                {projects.length === 0 ? (                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <FolderIcon size={48} color="var(--vscode-secondary-foreground)" />
                    </div>
                    <div className="empty-state-title">No Projects</div>
                    <div className="empty-state-description">
                      Add your first project to get started with development.
                    </div>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => setShowAddModal(true)}
                    >
                      <PlusIcon size={14} />
                      Add Project
                    </button>
                  </div>
                ) : (
                  <ul className="project-list">
                    {projects.map((project) => (
                      <li
                        key={project.id}
                        className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
                        onClick={() => selectProject(project.id)}
                        title={project.path}
                      >
                        <div className="project-item-icon">
                          <FolderIcon size={16} />
                        </div>
                        <div className="project-item-name">{project.name}</div>
                        <div className="project-item-actions">
                          <button
                            className="project-action-btn danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveProject(project);
                            }}                            title="Remove project"
                          >
                            <CloseIcon size={12} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          {projects.length > 0 && (            <button 
              className="add-project-btn" 
              onClick={() => setShowAddModal(true)}
              title="Add new project"
            >
              <PlusIcon size={14} />
              Add Project
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="main-content">
          {selectedProject ? (
            <>
              <div className="editor-tabs">                <div 
                  className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </div>
                <div 
                  className={`tab ${activeTab === 'scripts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('scripts')}
                >
                  Scripts
                </div>
                <div 
                  className={`tab ${activeTab === 'environment' ? 'active' : ''}`}
                  onClick={() => setActiveTab('environment')}
                >
                  Environment
                </div>
                <div 
                  className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  Settings
                </div>
              </div>
              <div className="editor-content">
                <div className="project-details">
                  <div className="project-header">
                    <h1 className="project-title">{selectedProject.name}</h1>
                    <div className="project-path">{selectedProject.path}</div>
                    <div className="project-meta">
                      <div className="meta-item">
                        <span>📅</span>
                        Created: {formatDate(selectedProject.createdAt)}
                      </div>
                      {selectedProject.lastAccessed && (
                        <div className="meta-item">
                          <span>🕒</span>
                          Last accessed: {formatDate(selectedProject.lastAccessed)} at {formatTime(selectedProject.lastAccessed)}
                        </div>
                      )}
                    </div>
                  </div>                  {activeTab === 'overview' && (
                    <div className="action-section">
                      <h2 className="section-title">Quick Actions</h2>
                      <div className="action-grid">
                        <button 
                          className="action-card"
                          onClick={() => openInIDE(selectedProject.id)}
                          title="Open project in IDE"
                        >
                          <div className="action-card-icon">
                            <CodeIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Open in IDE</div>
                            <div className="action-card-description">Launch your preferred IDE with this project</div>
                          </div>
                        </button>
                        <button 
                          className="action-card"
                          onClick={() => openFolder(selectedProject.id)}
                          title="Open project folder"
                        >
                          <div className="action-card-icon">
                            <FolderIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Open Folder</div>
                            <div className="action-card-description">Open project folder in file explorer</div>
                          </div>
                        </button>
                        <button 
                          className="action-card"
                          onClick={() => openInTerminal(selectedProject.id)}
                          title="Open project in terminal"
                        >
                          <div className="action-card-icon">
                            <TerminalIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Open Terminal</div>
                            <div className="action-card-description">Launch terminal in project directory</div>
                          </div>
                        </button>                        <button 
                          className="action-card"
                          onClick={() => startDevServer(selectedProject.id)}
                          title="Start development server"
                        >
                          <div className="action-card-icon">
                            <PlayIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Start Dev Server</div>
                            <div className="action-card-description">Auto-detect and run the development server</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}{activeTab === 'scripts' && (
                    <ScriptsTab 
                      project={selectedProject}
                      onAddScript={(script) => addScript(selectedProject.id, script)}
                      onRemoveScript={(scriptId) => removeScript(selectedProject.id, scriptId)}
                      onUpdateScript={(script) => updateScript(selectedProject.id, script)}
                      onExecuteScript={(scriptId) => executeScript(selectedProject.id, scriptId)}
                      onStopScript={(scriptId) => stopScript(selectedProject.id, scriptId)}
                    />
                  )}                  {activeTab === 'environment' && (
                    <EnvironmentTab projectId={selectedProject.id} />
                  )}                  {activeTab === 'settings' && (
                    <ProjectSettingsTab project={selectedProject} />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="editor-content">              <div className="empty-state">
                <div className="empty-state-icon">
                  <FolderIcon size={64} color="var(--vscode-secondary-foreground)" />
                </div>
                <div className="empty-state-title">Welcome to Local Dev Environment</div>
                <div className="empty-state-description">
                  Select a project from the sidebar to view its details and manage development tasks.
                  <br />
                  Get started by adding your first project.
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowAddModal(true)}
                >
                  <PlusIcon size={14} />
                  Add Your First Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Project</h3>              <button 
                className="modal-close"
                onClick={() => setShowAddModal(false)}
                title="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label className="form-label" htmlFor="projectName">
                  Project Name
                </label>
                <input
                  type="text"
                  id="projectName"
                  className="form-input"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter a name for your project"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowAddModal(false);
                  setNewProjectName('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddProject}
                disabled={!newProjectName.trim()}
              >
                Select Folder & Add
              </button>            </div>
          </div>
        </div>
      )}

      {/* Settings Page */}
      {showSettingsPage && (
        <SettingsPage onClose={() => setShowSettingsPage(false)} />
      )}
    </div>
  );
};

export default Dashboard;
