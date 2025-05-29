import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { EnvironmentVariable } from '../../types';
import { PlusIcon, TrashIcon, SaveIcon, BackupIcon, RefreshIcon } from './Icons';

interface EnvironmentTabProps {
  projectId: string;
}

export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({ projectId }) => {
  const { environmentConfig, loadEnvironment, saveEnvironment, backupEnvironment, environmentLoading, error } = useApp();
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Convert environment config to variables array
  useEffect(() => {
    if (environmentConfig) {
      const vars = Object.entries(environmentConfig.variables).map(([key, value]) => ({
        key,
        value,
      }));
      setVariables(vars);
      setHasChanges(false);
    } else {
      setVariables([]);
      setHasChanges(false);
    }
  }, [environmentConfig]);

  // Load environment when component mounts or project changes
  useEffect(() => {
    if (projectId) {
      loadEnvironment(projectId);
    }
  }, [projectId, loadEnvironment]);

  const handleAddVariable = () => {
    const newVar: EnvironmentVariable = {
      key: '',
      value: '',
      isNew: true,
    };
    setVariables(prev => [...prev, newVar]);
    setHasChanges(true);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleVariableChange = (index: number, field: 'key' | 'value', newValue: string) => {
    setVariables(prev => prev.map((variable, i) => 
      i === index ? { ...variable, [field]: newValue } : variable
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Convert variables array back to record format
    const variablesRecord: Record<string, string> = {};
    variables.forEach(variable => {
      if (variable.key.trim()) {
        variablesRecord[variable.key.trim()] = variable.value;
      }
    });

    await saveEnvironment(projectId, variablesRecord);
    setHasChanges(false);
  };

  const handleBackup = async () => {
    await backupEnvironment(projectId);
  };

  const handleRefresh = async () => {
    await loadEnvironment(projectId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };
  if (!environmentConfig && !environmentLoading) {
    return (
      <div className="environment-tab">
        <div className="tab-header">
          <h3>Environment Variables</h3>
          <div className="tab-actions">
            <button 
              className="button-icon"
              onClick={handleRefresh}
              title="Load environment"
              disabled={environmentLoading}
            >
              <RefreshIcon />
            </button>
          </div>
        </div>
        <div className="empty-state">
          <p>No .env file found in project</p>
          <button className="button-primary" onClick={handleAddVariable}>
            Create Environment Variables
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="environment-tab">
      <div className="tab-header">
        <h3>Environment Variables</h3>
        <div className="tab-actions">          <button 
            className="button-icon"
            onClick={handleRefresh}
            title="Refresh"
            disabled={environmentLoading}
          >
            <RefreshIcon />
          </button>
          {environmentConfig?.exists && (
            <button 
              className="button-icon"
              onClick={handleBackup}
              title="Backup .env file"
              disabled={environmentLoading}
            >
              <BackupIcon />
            </button>
          )}
          <button 
            className="button-icon"
            onClick={handleAddVariable}
            title="Add variable"
            disabled={environmentLoading}
          >
            <PlusIcon />
          </button>
          <button 
            className={`button-primary ${!hasChanges ? 'disabled' : ''}`}
            onClick={handleSave}
            title="Save changes (Ctrl+Enter)"
            disabled={environmentLoading || !hasChanges}
          >
            <SaveIcon />
            Save
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}      {environmentLoading && (
        <div className="loading-state">
          Loading environment variables...
        </div>
      )}

      <div className="environment-variables">
        {variables.length === 0 ? (
          <div className="empty-state">
            <p>No environment variables defined</p>
            <button className="button-secondary" onClick={handleAddVariable}>
              Add First Variable
            </button>
          </div>
        ) : (
          <div className="variables-list">
            <div className="variables-header">
              <div className="variable-key-header">Variable</div>
              <div className="variable-value-header">Value</div>
              <div className="variable-actions-header">Actions</div>
            </div>
            {variables.map((variable, index) => (
              <div key={index} className={`variable-row ${variable.isNew ? 'new-variable' : ''}`}>                <input
                  type="text"
                  placeholder="VARIABLE_NAME"
                  value={variable.key}
                  onChange={(e) => handleVariableChange(index, 'key', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="variable-key-input"
                  disabled={environmentLoading}
                />
                <input
                  type="text"
                  placeholder="variable value"
                  value={variable.value}
                  onChange={(e) => handleVariableChange(index, 'value', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="variable-value-input"
                  disabled={environmentLoading}
                />
                <button
                  className="button-icon danger"
                  onClick={() => handleRemoveVariable(index)}
                  title="Remove variable"
                  disabled={environmentLoading}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="changes-indicator">
          <span>Unsaved changes</span>
          <button className="button-link" onClick={handleSave}>
            Save now (Ctrl+Enter)
          </button>
        </div>
      )}

      {environmentConfig?.exists && (
        <div className="environment-info">
          <small>
            Environment file: .env
            {variables.length > 0 && ` (${variables.length} variable${variables.length !== 1 ? 's' : ''})`}
          </small>
        </div>
      )}
    </div>
  );
};
