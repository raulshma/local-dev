import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../../types';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { projects, selectedProject, isLoading, error, addProject, removeProject, selectProject } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

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
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Local Dev Environment Dashboard</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddModal(true)}
        >
          Add Project
        </button>
      </div>

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      <div className="dashboard-content">
        <div className="projects-sidebar">
          <h2>Projects</h2>
          {projects.length === 0 ? (
            <div className="no-projects">
              <p>No projects added yet.</p>
              <p>Click "Add Project" to get started!</p>
            </div>
          ) : (
            <div className="projects-list">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
                  onClick={() => selectProject(project.id)}
                >
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <p className="project-path">{project.path}</p>
                    <p className="project-date">Added: {formatDate(project.createdAt)}</p>
                    {project.lastAccessed && (
                      <p className="project-date">Last accessed: {formatDate(project.lastAccessed)}</p>
                    )}
                  </div>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveProject(project);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="project-details">
          {selectedProject ? (
            <div>
              <h2>{selectedProject.name}</h2>
              <p className="selected-project-path">{selectedProject.path}</p>
              <div className="project-actions">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                  <button className="btn btn-secondary">Open in IDE</button>
                  <button className="btn btn-secondary">Open Folder</button>
                  <button className="btn btn-secondary">Open Terminal</button>
                </div>
              </div>
              
              <div className="project-scripts">
                <h3>Scripts</h3>
                <p>Script management coming soon...</p>
              </div>
              
              <div className="project-env">
                <h3>Environment Variables</h3>
                <p>Environment variable editor coming soon...</p>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <h2>Select a Project</h2>
              <p>Choose a project from the sidebar to view its details and manage scripts.</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New Project</h3>
            <div className="form-group">
              <label htmlFor="projectName">Project Name:</label>
              <input
                type="text"
                id="projectName"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
                autoFocus
              />
            </div>
            <div className="modal-actions">
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
