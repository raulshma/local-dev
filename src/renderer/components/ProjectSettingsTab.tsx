import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../../types';

interface ProjectSettingsTabProps {
  project: Project;
}

const ProjectSettingsTab: React.FC<ProjectSettingsTabProps> = ({ project }) => {
  const { loadProjectSettings, saveProjectSettings, error } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projectSettings, setProjectSettings] = useState<{
    ideCommand?: string;
    terminalCommand?: string;
  }>({});
  const [effectiveSettings, setEffectiveSettings] = useState<{
    ideCommand: string;
    terminalCommand?: string;
  }>({
    ideCommand: 'code'
  });

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const result = await loadProjectSettings(project.id);
      if (result) {
        setProjectSettings(result.projectSettings);
        setEffectiveSettings(result.effectiveSettings);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [project.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProjectSettings(project.id, projectSettings);
      // Reload to get updated effective settings
      await loadSettings();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setProjectSettings({});
  };

  const hasChanges = projectSettings.ideCommand !== undefined || projectSettings.terminalCommand !== undefined;

  if (isLoading) {
    return (
      <div className="project-settings-tab">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="project-settings-tab">
      <div className="settings-header">
        <h2 className="section-title">Project Settings</h2>
        <p className="settings-description">
          Configure IDE and terminal preferences for this project. Leave empty to use global defaults.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="settings-form">
        <div className="form-section">
          <h3 className="form-section-title">IDE Configuration</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="ideCommand">
              IDE Command
            </label>
            <input
              type="text"
              id="ideCommand"
              className="form-input"
              value={projectSettings.ideCommand || ''}
              onChange={(e) => setProjectSettings(prev => ({
                ...prev,
                ideCommand: e.target.value || undefined
              }))}
              placeholder={`Default: ${effectiveSettings.ideCommand}`}
            />            <div className="form-help">
              <p>Command to launch your preferred IDE. Examples:</p>
              <ul>
                <li><code>cursor</code> - Cursor AI IDE</li>
                <li><code>code</code> - Visual Studio Code</li>
                <li><code>idea</code> - IntelliJ IDEA</li>
                <li><code>webstorm</code> - WebStorm</li>
                <li><code>atom</code> - Atom</li>
                <li><code>subl</code> - Sublime Text</li>
                <li><code>/path/to/custom/editor</code> - Full path to custom editor</li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="terminalCommand">
              Terminal Command
            </label>
            <input
              type="text"
              id="terminalCommand"
              className="form-input"
              value={projectSettings.terminalCommand || ''}
              onChange={(e) => setProjectSettings(prev => ({
                ...prev,
                terminalCommand: e.target.value || undefined
              }))}
              placeholder={effectiveSettings.terminalCommand || 'Default: System terminal'}
            />
            <div className="form-help">
              <p>Custom terminal command (optional). Examples:</p>
              <ul>
                <li><code>wt</code> - Windows Terminal</li>
                <li><code>iterm</code> - iTerm2 (macOS)</li>
                <li><code>kitty</code> - Kitty terminal</li>
                <li><code>alacritty</code> - Alacritty</li>
                <li><code>/path/to/terminal</code> - Full path to custom terminal</li>
              </ul>
              <p><strong>Note:</strong> Leave empty to use the default system terminal for your OS.</p>
            </div>
          </div>
        </div>

        <div className="effective-settings">
          <h3 className="form-section-title">Current Effective Settings</h3>
          <div className="settings-preview">
            <div className="setting-item">
              <span className="setting-label">IDE Command:</span>
              <code className="setting-value">{effectiveSettings.ideCommand}</code>
            </div>
            <div className="setting-item">
              <span className="setting-label">Terminal:</span>
              <code className="setting-value">
                {effectiveSettings.terminalCommand || 'System default'}
              </code>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            Reset to Defaults
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsTab;
