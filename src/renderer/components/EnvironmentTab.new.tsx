import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { EnvironmentVariable, EnvironmentConfiguration } from '../../types';
import {
  PlusIcon,
  TrashIcon,
  SaveIcon,
  BackupIcon,
  RefreshIcon,
} from './Icons';

interface EnvironmentTabProps {
  projectId: string;
}

interface CreateConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, filename: string, template?: string) => void;
}

const CreateConfigDialog: React.FC<CreateConfigDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState('');
  const [filename, setFilename] = useState('');
  const [template, setTemplate] = useState('');

  const templates = [
    { value: '', label: 'Empty Configuration' },
    { value: 'development', label: 'Development Template' },
    { value: 'staging', label: 'Staging Template' },
    { value: 'production', label: 'Production Template' },
    { value: 'testing', label: 'Testing Template' },
  ];

  const presetConfigs = [
    { name: 'Development', filename: '.env.dev' },
    { name: 'Staging', filename: '.env.staging' },
    { name: 'Production', filename: '.env.production' },
    { name: 'Testing', filename: '.env.test' },
    { name: 'Local', filename: '.env.local' },
  ];

  const handlePresetSelect = (preset: { name: string; filename: string }) => {
    setName(preset.name);
    setFilename(preset.filename);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && filename.trim()) {
      onConfirm(name.trim(), filename.trim(), template || undefined);
      setName('');
      setFilename('');
      setTemplate('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Create New Environment Configuration</h3>

        <div className="config-presets">
          <label>Quick Presets:</label>
          <div className="preset-buttons">
            {presetConfigs.map((preset) => (
              <button
                key={preset.filename}
                type="button"
                className="button-secondary small"
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="config-name">Configuration Name:</label>
            <input
              id="config-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Development, Production"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="config-filename">Filename:</label>
            <input
              id="config-filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g., .env.dev, .env.production"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="config-template">Template:</label>
            <select
              id="config-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              {templates.map((tmpl) => (
                <option key={tmpl.value} value={tmpl.value}>
                  {tmpl.label}
                </option>
              ))}
            </select>
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Create Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
  projectId,
}) => {
  const [envConfigs, setEnvConfigs] = useState<EnvironmentConfiguration[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | undefined>();
  const [activeConfig, setActiveConfig] =
    useState<EnvironmentConfiguration | null>(null);
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Load environment configurations
  const loadEnvironmentConfigs = async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electron.envConfig.load(projectId);

      if (result.success && result.metadata) {
        setEnvConfigs(result.metadata.configurations);
        setActiveConfigId(result.metadata.activeConfigId);
        // Find and set active configuration
        const active = result.metadata.configurations.find(
          (config: EnvironmentConfiguration) =>
            config.id === result.metadata?.activeConfigId,
        );

        if (active) {
          setActiveConfig(active);
          const vars: EnvironmentVariable[] = Object.entries(
            active.variables,
          ).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          setVariables(vars);
        } else {
          setActiveConfig(null);
          setVariables([]);
        }

        setHasChanges(false);
      } else {
        setError(result.error || 'Failed to load environment configurations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Switch active configuration
  const switchConfiguration = async (configId: string) => {
    if (hasChanges) {
      const shouldSwitch = window.confirm(
        'You have unsaved changes. Are you sure you want to switch configurations? Unsaved changes will be lost.',
      );
      if (!shouldSwitch) return;
    }

    try {
      const result = await window.electron.envConfig.switch(
        projectId,
        configId,
      );

      if (result.success) {
        setActiveConfigId(configId);
        const config = envConfigs.find((c) => c.id === configId);
        if (config) {
          setActiveConfig(config);
          const vars: EnvironmentVariable[] = Object.entries(
            config.variables,
          ).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          setVariables(vars);
          setHasChanges(false);
        }
      } else {
        setError(result.error || 'Failed to switch configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Create new configuration
  const createConfiguration = async (
    name: string,
    filename: string,
    template?: string,
  ) => {
    try {
      const result = await window.electron.envConfig.create(
        projectId,
        name,
        filename,
        template,
      );

      if (result.success && result.configuration) {
        // Reload configurations to get the updated list
        await loadEnvironmentConfigs();
      } else {
        setError(result.error || 'Failed to create configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Delete configuration
  const deleteConfiguration = async (configId: string) => {
    const config = envConfigs.find((c) => c.id === configId);
    if (!config) return;

    const shouldDelete = window.confirm(
      `Are you sure you want to delete the configuration "${config.displayName}"? This will also delete the file "${config.filename}".`,
    );

    if (!shouldDelete) return;

    try {
      const result = await window.electron.envConfig.remove(
        projectId,
        configId,
      );

      if (result.success) {
        // Reload configurations to get the updated list
        await loadEnvironmentConfigs();
      } else {
        setError(result.error || 'Failed to delete configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Save current configuration
  const saveConfiguration = async () => {
    if (!activeConfig) return;

    // Convert variables array back to record format
    const variablesRecord: Record<string, string> = {};
    variables.forEach((variable) => {
      if (variable.key.trim()) {
        variablesRecord[variable.key.trim()] = variable.value;
      }
    });

    try {
      const result = await window.electron.envConfig.save(
        projectId,
        activeConfig.id,
        variablesRecord,
      );

      if (result.success) {
        // Update local state
        const updatedConfig = { ...activeConfig, variables: variablesRecord };
        setActiveConfig(updatedConfig);
        setEnvConfigs((prev) =>
          prev.map((c) => (c.id === activeConfig.id ? updatedConfig : c)),
        );
        setHasChanges(false);
      } else {
        setError(result.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Variable management functions
  const handleAddVariable = () => {
    const newVar: EnvironmentVariable = {
      key: '',
      value: '',
      isNew: true,
    };
    setVariables((prev) => [...prev, newVar]);
    setHasChanges(true);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleVariableChange = (
    index: number,
    field: 'key' | 'value',
    newValue: string,
  ) => {
    setVariables((prev) =>
      prev.map((variable, i) =>
        i === index ? { ...variable, [field]: newValue } : variable,
      ),
    );
    setHasChanges(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveConfiguration();
    }
  };

  // Load configurations when component mounts or project changes
  useEffect(() => {
    if (projectId) {
      loadEnvironmentConfigs();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="environment-tab">
        <div className="loading-state">
          Loading environment configurations...
        </div>
      </div>
    );
  }

  return (
    <div className="environment-tab">
      <div className="tab-header">
        <h3>Environment Variables</h3>
        <div className="tab-actions">
          <button
            className="button-icon"
            onClick={loadEnvironmentConfigs}
            title="Refresh configurations"
            disabled={loading}
          >
            <RefreshIcon />
          </button>
          <button
            className="button-secondary"
            onClick={() => setShowCreateDialog(true)}
            title="Create new configuration"
            disabled={loading}
          >
            <PlusIcon />
            New Config
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button
            className="button-link"
            onClick={() => setError(null)}
            style={{ marginLeft: '8px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Configuration Selector */}
      {envConfigs.length > 0 && (
        <div className="config-selector">
          <label htmlFor="config-select">Configuration:</label>
          <div className="config-selector-group">
            <select
              id="config-select"
              value={activeConfigId || ''}
              onChange={(e) =>
                e.target.value && switchConfiguration(e.target.value)
              }
              disabled={loading}
            >
              {!activeConfigId && (
                <option value="">Select a configuration...</option>
              )}
              {envConfigs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.displayName} ({config.filename})
                  {!config.exists && ' - Not Found'}
                </option>
              ))}
            </select>
            {activeConfig && (
              <button
                className="button-danger small"
                onClick={() => deleteConfiguration(activeConfig.id)}
                title="Delete configuration"
                disabled={loading}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Configuration Actions */}
      {activeConfig && (
        <div className="config-actions">
          <button
            className="button-icon"
            onClick={handleAddVariable}
            title="Add variable"
            disabled={loading}
          >
            <PlusIcon />
          </button>
          <button
            className={`button-primary ${!hasChanges ? 'disabled' : ''}`}
            onClick={saveConfiguration}
            title="Save changes (Ctrl+Enter)"
            disabled={loading || !hasChanges}
          >
            <SaveIcon />
            Save
          </button>
        </div>
      )}

      {/* Variables List */}
      {activeConfig ? (
        <div className="environment-variables">
          {variables.length === 0 ? (
            <div className="empty-state">
              <p>
                No environment variables defined in {activeConfig.displayName}
              </p>
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
                <div
                  key={index}
                  className={`variable-row ${variable.isNew ? 'new-variable' : ''}`}
                >
                  <input
                    type="text"
                    placeholder="VARIABLE_NAME"
                    value={variable.key}
                    onChange={(e) =>
                      handleVariableChange(index, 'key', e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="variable-key-input"
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder="variable value"
                    value={variable.value}
                    onChange={(e) =>
                      handleVariableChange(index, 'value', e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="variable-value-input"
                    disabled={loading}
                  />
                  <button
                    className="button-icon danger"
                    onClick={() => handleRemoveVariable(index)}
                    title="Remove variable"
                    disabled={loading}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : envConfigs.length === 0 ? (
        <div className="empty-state">
          <p>No environment configurations found</p>
          <button
            className="button-primary"
            onClick={() => setShowCreateDialog(true)}
          >
            Create First Configuration
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <p>Select a configuration to view and edit environment variables</p>
        </div>
      )}

      {/* Configuration Info */}
      {activeConfig && (
        <div className="environment-info">
          <small>
            Configuration: {activeConfig.displayName} ({activeConfig.filename})
            {activeConfig.template && ` • Template: ${activeConfig.template}`}
            {variables.length > 0 &&
              ` • ${variables.length} variable${variables.length !== 1 ? 's' : ''}`}
            {hasChanges && ' • Unsaved changes'}
          </small>
        </div>
      )}

      {hasChanges && (
        <div className="changes-indicator">
          <span>Unsaved changes</span>
          <button className="button-link" onClick={saveConfiguration}>
            Save now (Ctrl+Enter)
          </button>
        </div>
      )}

      <CreateConfigDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={createConfiguration}
      />
    </div>
  );
};
