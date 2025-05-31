import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../../types';
import ScriptsTab from './ScriptsTab';
import { EnvironmentTab } from './EnvironmentTab';
import ProjectSettingsTab from './ProjectSettingsTab';
import GitTab from './GitTab';
import DockerTab from './DockerTab';
import SettingsPage from './SettingsPage';
import TerminalPanel from './TerminalPanel';
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
    runningScripts,
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
  const [dockerConfigurations, setDockerConfigurations] = useState<Map<string, boolean>>(new Map());

  // Terminal state
  const [isTerminalVisible, setIsTerminalVisible] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(300);

  // Detect Docker configurations for all projects
  useEffect(() => {
    const detectDockerConfigurations = async () => {
      const newConfigs = new Map<string, boolean>();

      await Promise.all(
        projects.map(async (project) => {
          try {
            const result = await window.electron.docker.detectConfiguration(
              project.id,
            );
            if (result.success && result.config) {
              const hasDocker =
                result.config.hasDockerfile || result.config.hasDockerCompose;
              newConfigs.set(project.id, hasDocker);
            }
          } catch (err) {
            // Silently ignore errors for now
          }
        }),
      );

      setDockerConfigurations(newConfigs);
    };

    if (projects.length > 0) {
      detectDockerConfigurations();
    }
  }, [projects]);

  // Helper function to get running script indicators for a project
  const getProjectScriptStatus = (projectId: string) => {
    const runningProjectScripts = Array.from(runningScripts)
      .filter(scriptKey => scriptKey.startsWith(`${projectId}:`));

    const runningCount = runningProjectScripts.length;

    if (runningCount === 0) return null;

    return {
      count: runningCount,
      status: 'running' as const
    };
  };

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
      <div className="dashboard-container">
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
          <div
            className={`activity-bar-item ${isTerminalVisible ? 'active' : ''}`}
            title="Terminal"
            onClick={() => setIsTerminalVisible(!isTerminalVisible)}
          >
            <div className="activity-bar-icon">
              <TerminalIcon size={20} />
            </div>
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
                    {projects.map((project) => {
                      const scriptStatus = getProjectScriptStatus(project.id);

                      return (
                        <li
                          key={project.id}
                          className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
                          onClick={() => selectProject(project.id)}
                          title={project.path}
                        >
                          <div className="project-item-icon">
                            <FolderIcon size={16} />
                            {scriptStatus && (
                              <div className="project-status-indicator">
                                <div
                                  className={`status-dot status-${scriptStatus.status}`}
                                  title={`${scriptStatus.count} script${scriptStatus.count > 1 ? 's' : ''} running`}
                                />
                                {scriptStatus.count > 1 && (
                                  <span className="status-count">{scriptStatus.count}</span>
                                )}
                              </div>
                            )}
                            {dockerConfigurations.get(project.id) && (
                              <div className="docker-indicator" title="Docker project">
                                🐳
                              </div>
                            )}
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
                      );
                    })}
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
                  className={`tab ${activeTab === 'git' ? 'active' : ''}`}
                  onClick={() => setActiveTab('git')}
                >
                  Git
                </div>
                <div
                  className={`tab ${activeTab === 'docker' ? 'active' : ''}`}
                  onClick={() => setActiveTab('docker')}
                >
                  Docker
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

                      {/* Docker Quick Actions */}
                      {dockerConfigurations.get(selectedProject.id) && (
                        <>
                          <h2 className="section-title">Docker Actions</h2>
                          <div className="action-grid">
                            <button
                              className="action-card docker-action"
                              onClick={async () => {
                                try {
                                  await window.electron.docker.executeScript(selectedProject.id, 'build');
                                } catch (err) {
                                  console.error('Failed to build Docker image:', err);
                                }
                              }}
                              title="Build Docker image"
                            >
                              <div className="action-card-icon">
                                🐳
                              </div>
                              <div className="action-card-content">
                                <div className="action-card-title">Build Image</div>
                                <div className="action-card-description">Build Docker image from Dockerfile</div>
                              </div>
                            </button>
                            <button
                              className="action-card docker-action"
                              onClick={async () => {
                                try {
                                  await window.electron.docker.executeScript(selectedProject.id, 'run');
                                } catch (err) {
                                  console.error('Failed to run Docker container:', err);
                                }
                              }}
                              title="Run Docker container"
                            >
                              <div className="action-card-icon">
                                🚀
                              </div>
                              <div className="action-card-content">
                                <div className="action-card-title">Run Container</div>
                                <div className="action-card-description">Start container from built image</div>
                              </div>
                            </button>
                            <button
                              className="action-card docker-action"
                              onClick={async () => {
                                try {
                                  await window.electron.docker.executeScript(selectedProject.id, 'compose-up');
                                } catch (err) {
                                  console.error('Failed to start Docker Compose:', err);
                                }
                              }}
                              title="Docker Compose up"
                            >
                              <div className="action-card-icon">
                                📦
                              </div>
                              <div className="action-card-content">
                                <div className="action-card-title">Compose Up</div>
                                <div className="action-card-description">Start all services with Docker Compose</div>
                              </div>
                            </button>
                            <button
                              className="action-card docker-action"
                              onClick={async () => {
                                try {
                                  await window.electron.docker.executeScript(selectedProject.id, 'logs');
                                } catch (err) {
                                  console.error('Failed to view Docker logs:', err);
                                }
                              }}
                              title="View container logs"
                            >
                              <div className="action-card-icon">
                                📋
                              </div>
                              <div className="action-card-content">
                                <div className="action-card-title">View Logs</div>
                                <div className="action-card-description">Show container logs</div>
                              </div>
                            </button>
                            <button
                              className="action-card docker-action"
                              onClick={async () => {
                                try {
                                  await window.electron.docker.executeScript(selectedProject.id, 'stop');
                                } catch (err) {
                                  console.error('Failed to stop Docker containers:', err);
                                }
                              }}
                              title="Stop all containers"
                            >
                              <div className="action-card-icon">
                                🛑
                              </div>
                              <div className="action-card-content">
                                <div className="action-card-title">Stop All</div>
                                <div className="action-card-description">Stop all running containers</div>
                              </div>
                            </button>
                            <button
                              className="action-card docker-action"
                              onClick={async () => {
                                try {
                                  await window.electron.docker.executeScript(selectedProject.id, 'compose-down');
                                } catch (err) {
                                  console.error('Failed to stop Docker Compose:', err);
                                }
                              }}
                              title="Docker Compose down"
                            >
                              <div className="action-card-icon">
                                📦
                              </div>
                              <div className="action-card-content">
                                <div className="action-card-title">Compose Down</div>
                                <div className="action-card-description">Stop and remove all Compose services</div>
                              </div>
                            </button>
                          </div>
                        </>
                      )}
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
                  )}

                  {activeTab === 'git' && (
                    <GitTab projectId={selectedProject.id} />
                  )}

                  {activeTab === 'docker' && (
                    <DockerTab projectId={selectedProject.id} />
                  )}

                  {activeTab === 'settings' && (
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

      {/* Terminal Panel */}
      <TerminalPanel
        isVisible={isTerminalVisible}
        onToggle={() => setIsTerminalVisible(!isTerminalVisible)}
        projectPath={selectedProject?.path}
        onHeightChange={setTerminalHeight}
      />
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
