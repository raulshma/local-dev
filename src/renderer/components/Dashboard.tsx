import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../../types';
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

const Dashboard: React.FC = () => {
  const { projects, selectedProject, isLoading, error, addProject, removeProject, selectProject } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
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
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            Explorer
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
              <div className="editor-tabs">
                <div 
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
                  </div>

                  {activeTab === 'overview' && (
                    <div className="action-section">
                      <h2 className="section-title">Quick Actions</h2>                      <div className="action-grid">
                        <div className="action-card">
                          <div className="action-card-icon">
                            <CodeIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Open in VS Code</div>
                            <div className="action-card-description">Launch VS Code with this project</div>
                          </div>
                        </div>
                        <div className="action-card">
                          <div className="action-card-icon">
                            <FolderIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Open Folder</div>
                            <div className="action-card-description">Open project folder in file explorer</div>
                          </div>
                        </div>
                        <div className="action-card">
                          <div className="action-card-icon">
                            <TerminalIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Open Terminal</div>
                            <div className="action-card-description">Launch terminal in project directory</div>
                          </div>
                        </div>
                        <div className="action-card">
                          <div className="action-card-icon">
                            <PlayIcon size={20} />
                          </div>
                          <div className="action-card-content">
                            <div className="action-card-title">Start Dev Server</div>
                            <div className="action-card-description">Run the development server</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'scripts' && (
                    <div className="action-section">
                      <h2 className="section-title">Available Scripts</h2>                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <SettingsIcon size={48} color="var(--vscode-secondary-foreground)" />
                        </div>
                        <div className="empty-state-title">Script Management</div>
                        <div className="empty-state-description">
                          Script detection and management features are coming soon.
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'environment' && (
                    <div className="action-section">
                      <h2 className="section-title">Environment Variables</h2>                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <SettingsIcon size={48} color="var(--vscode-secondary-foreground)" />
                        </div>
                        <div className="empty-state-title">Environment Configuration</div>
                        <div className="empty-state-description">
                          Environment variable editor and management features are coming soon.
                        </div>
                      </div>
                    </div>
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
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
