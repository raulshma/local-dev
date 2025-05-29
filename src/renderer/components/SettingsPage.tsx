import React, { useState, useEffect } from 'react';
import { SettingsIcon, CloseIcon, ChevronRightIcon } from './Icons';
import './SettingsPage.css';

interface AppSettings {
  // General settings
  startupBehavior: 'last-state' | 'empty' | 'dashboard';
  autoUpdate: boolean;
  checkForUpdatesOnStartup: boolean;
  
  // Appearance settings
  theme: 'light' | 'dark' | 'auto' | 'high-contrast';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  
  // Integration settings
  ideCommand: string;
  terminalCommand: string;
  gitClientCommand: string;
  
  // Performance settings
  maxBackgroundProcesses: number;
  enableFileWatching: boolean;
  cacheSize: number;
  
  // Security settings
  restrictProjectPaths: boolean;
  allowedPaths: string[];
  enableSafeMode: boolean;
}

interface SettingsPageProps {
  onClose: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
  const [activeCategory, setActiveCategory] = useState('general');
  const [settings, setSettings] = useState<AppSettings>({
    // Default values
    startupBehavior: 'last-state',
    autoUpdate: true,
    checkForUpdatesOnStartup: true,
    theme: 'auto',
    fontSize: 'medium',
    compactMode: false,
    ideCommand: 'code',
    terminalCommand: 'powershell.exe',
    gitClientCommand: 'git',
    maxBackgroundProcesses: 5,
    enableFileWatching: true,
    cacheSize: 100,
    restrictProjectPaths: false,
    allowedPaths: [],
    enableSafeMode: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [expertMode, setExpertMode] = useState(false);

  const categories = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'performance', label: 'Performance', icon: '⚡' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];

  const themes = [
    { id: 'light', label: 'Light', description: 'Light color theme' },
    { id: 'dark', label: 'Dark', description: 'Dark color theme' },
    { id: 'auto', label: 'Auto', description: 'Follow system preference' },
    { id: 'high-contrast', label: 'High Contrast', description: 'High contrast theme for accessibility' },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await window.electron.settings.get();
      if (result.success && result.settings) {
        setSettings(prev => ({ ...prev, ...result.settings }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const result = await window.electron.settings.update(settings);
      if (result.success) {
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      setSettings({
        startupBehavior: 'last-state',
        autoUpdate: true,
        checkForUpdatesOnStartup: true,
        theme: 'auto',
        fontSize: 'medium',
        compactMode: false,
        ideCommand: 'code',
        terminalCommand: 'powershell.exe',
        gitClientCommand: 'git',
        maxBackgroundProcesses: 5,
        enableFileWatching: true,
        cacheSize: 100,
        restrictProjectPaths: false,
        allowedPaths: [],
        enableSafeMode: false,
      });
      setHasChanges(true);
    }
  };

  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'local-dev-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedSettings = JSON.parse(e.target?.result as string);
            setSettings(prev => ({ ...prev, ...importedSettings }));
            setHasChanges(true);
          } catch (error) {
            alert('Invalid settings file format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const renderGeneralSettings = () => (
    <div className="settings-section">
      <h3>General Settings</h3>
      
      <div className="setting-group">
        <label className="setting-label">Startup Behavior</label>
        <select
          className="setting-select"
          value={settings.startupBehavior}
          onChange={(e) => handleSettingChange('startupBehavior', e.target.value)}
        >
          <option value="last-state">Restore last state</option>
          <option value="empty">Start with no projects</option>
          <option value="dashboard">Always show dashboard</option>
        </select>
        <p className="setting-description">
          Choose what happens when the application starts
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.autoUpdate}
            onChange={(e) => handleSettingChange('autoUpdate', e.target.checked)}
          />
          <span className="setting-checkbox-label">Enable automatic updates</span>
        </label>
        <p className="setting-description">
          Automatically download and install updates when available
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.checkForUpdatesOnStartup}
            onChange={(e) => handleSettingChange('checkForUpdatesOnStartup', e.target.checked)}
          />
          <span className="setting-checkbox-label">Check for updates on startup</span>
        </label>
        <p className="setting-description">
          Check for available updates when the application starts
        </p>
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="settings-section">
      <h3>Appearance Settings</h3>
      
      <div className="setting-group">
        <label className="setting-label">Theme</label>
        <div className="theme-options">
          {themes.map((theme) => (
            <label key={theme.id} className="theme-option">
              <input
                type="radio"
                name="theme"
                value={theme.id}
                checked={settings.theme === theme.id}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
              />
              <div className="theme-option-content">
                <span className="theme-option-label">{theme.label}</span>
                <span className="theme-option-description">{theme.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">Font Size</label>
        <select
          className="setting-select"
          value={settings.fontSize}
          onChange={(e) => handleSettingChange('fontSize', e.target.value)}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.compactMode}
            onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
          />
          <span className="setting-checkbox-label">Compact mode</span>
        </label>
        <p className="setting-description">
          Use a more compact layout to fit more content on screen
        </p>
      </div>
    </div>
  );

  const renderIntegrationsSettings = () => (
    <div className="settings-section">
      <h3>Integration Settings</h3>
      
      <div className="setting-group">
        <label className="setting-label">IDE Command</label>
        <input
          type="text"
          className="setting-input"
          value={settings.ideCommand}
          onChange={(e) => handleSettingChange('ideCommand', e.target.value)}
          placeholder="e.g., code, idea, subl"
        />
        <p className="setting-description">
          Command to launch your preferred IDE. Examples: code (VS Code), idea (IntelliJ), subl (Sublime)
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-label">Terminal Command</label>
        <input
          type="text"
          className="setting-input"
          value={settings.terminalCommand}
          onChange={(e) => handleSettingChange('terminalCommand', e.target.value)}
          placeholder="e.g., powershell.exe, cmd.exe, wt.exe"
        />
        <p className="setting-description">
          Command to launch your preferred terminal application
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-label">Git Client Command</label>
        <input
          type="text"
          className="setting-input"
          value={settings.gitClientCommand}
          onChange={(e) => handleSettingChange('gitClientCommand', e.target.value)}
          placeholder="e.g., git, github-desktop, sourcetree"
        />
        <p className="setting-description">
          Command to launch your preferred Git client
        </p>
      </div>
    </div>
  );

  const renderPerformanceSettings = () => (
    <div className="settings-section">
      <h3>Performance Settings</h3>
      
      <div className="setting-group">
        <label className="setting-label">Max Background Processes</label>
        <input
          type="number"
          className="setting-input"
          min="1"
          max="20"
          value={settings.maxBackgroundProcesses}
          onChange={(e) => handleSettingChange('maxBackgroundProcesses', parseInt(e.target.value))}
        />
        <p className="setting-description">
          Maximum number of concurrent background processes (1-20)
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.enableFileWatching}
            onChange={(e) => handleSettingChange('enableFileWatching', e.target.checked)}
          />
          <span className="setting-checkbox-label">Enable file watching</span>
        </label>
        <p className="setting-description">
          Monitor project files for changes to auto-refresh project information
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-label">Cache Size (MB)</label>
        <input
          type="number"
          className="setting-input"
          min="10"
          max="1000"
          value={settings.cacheSize}
          onChange={(e) => handleSettingChange('cacheSize', parseInt(e.target.value))}
        />
        <p className="setting-description">
          Amount of disk space to use for caching project data
        </p>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="settings-section">
      <h3>Security Settings</h3>
      
      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.restrictProjectPaths}
            onChange={(e) => handleSettingChange('restrictProjectPaths', e.target.checked)}
          />
          <span className="setting-checkbox-label">Restrict project paths</span>
        </label>
        <p className="setting-description">
          Only allow projects from specified safe directories
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.enableSafeMode}
            onChange={(e) => handleSettingChange('enableSafeMode', e.target.checked)}
          />
          <span className="setting-checkbox-label">Enable safe mode</span>
        </label>
        <p className="setting-description">
          Restrict potentially dangerous operations and require confirmation for script execution
        </p>
      </div>
    </div>
  );

  const renderExpertMode = () => (
    <div className="settings-section">
      <h3>Expert Configuration</h3>
      <div className="expert-mode">
        <textarea
          className="expert-textarea"
          value={JSON.stringify(settings, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setSettings(parsed);
              setHasChanges(true);
            } catch (error) {
              // Invalid JSON, don't update
            }
          }}
          rows={20}
        />
        <p className="setting-description">
          Direct JSON configuration editing. Be careful - invalid JSON may cause issues.
        </p>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    if (expertMode) return renderExpertMode();
    
    switch (activeCategory) {
      case 'general': return renderGeneralSettings();
      case 'appearance': return renderAppearanceSettings();
      case 'integrations': return renderIntegrationsSettings();
      case 'performance': return renderPerformanceSettings();
      case 'security': return renderSecuritySettings();
      default: return renderGeneralSettings();
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-title">
          <SettingsIcon size={20} />
          <span>Settings</span>
        </div>
        <button className="settings-close" onClick={onClose} title="Close settings">
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-sidebar">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`settings-category ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className="settings-category-icon">{category.icon}</span>
              <span className="settings-category-label">{category.label}</span>
              <ChevronRightIcon size={12} />
            </div>
          ))}
          
          <div className="settings-actions">
            <button 
              className={`settings-action ${expertMode ? 'active' : ''}`}
              onClick={() => setExpertMode(!expertMode)}
            >
              Expert Mode
            </button>
            <button className="settings-action" onClick={handleImportSettings}>
              Import Settings
            </button>
            <button className="settings-action" onClick={handleExportSettings}>
              Export Settings
            </button>
            <button className="settings-action danger" onClick={handleReset}>
              Reset to Defaults
            </button>
          </div>
        </div>

        <div className="settings-main">
          {renderActiveSection()}
        </div>
      </div>

      <div className="settings-footer">
        <div className="settings-footer-left">
          {hasChanges && <span className="changes-indicator">• Unsaved changes</span>}
        </div>
        <div className="settings-footer-right">
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              if (hasChanges) {
                if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
