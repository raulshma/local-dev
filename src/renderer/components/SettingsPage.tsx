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

  // Notification settings
  notifications?: {
    scriptEvents?: boolean;
    projectEvents?: boolean;
    systemEvents?: boolean;
    scriptCompletion?: boolean;
    scriptErrors?: boolean;
    scriptWarnings?: boolean;
    minimizeToTray?: boolean;
  };

  // Background operation settings
  backgroundOperation?: {
    enableMinimalMode?: boolean;
    continueBackgroundTasks?: boolean;
    backgroundTaskLimit?: number;
    resourceLimitCpuPercent?: number;
    resourceLimitMemoryMb?: number;
    gitPollingInterval?: number;
    fileWatchingThrottle?: number;
  };
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
    notifications: {
      scriptEvents: true,
      projectEvents: true,
      systemEvents: true,
      scriptCompletion: true,
      scriptErrors: true,
      scriptWarnings: true,
      minimizeToTray: true,
    },
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [expertMode, setExpertMode] = useState(false);

  const categories = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'background', label: 'Background', icon: '⚙️' },
    { id: 'performance', label: 'Performance', icon: '⚡' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];

  const themes = [
    { id: 'light', label: 'Light', description: 'Light color theme' },
    { id: 'dark', label: 'Dark', description: 'Dark color theme' },
    { id: 'auto', label: 'Auto', description: 'Follow system preference' },
    {
      id: 'high-contrast',
      label: 'High Contrast',
      description: 'High contrast theme for accessibility',
    },
  ];

  const loadSettings = async () => {
    try {
      const result = await window.electron.settings.get();
      if (result.success && result.settings) {
        setSettings((prev) => ({ ...prev, ...result.settings }));
      }
    } catch (error) {
      // Handle error silently in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading settings:', error);
      }
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleNotificationSettingChange = (
    key: keyof NonNullable<AppSettings['notifications']>,
    value: boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleBackgroundSettingChange = (
    key: keyof NonNullable<AppSettings['backgroundOperation']>,
    value: any,
  ) => {
    setSettings((prev) => ({
      ...prev,
      backgroundOperation: {
        ...prev.backgroundOperation,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      const result = await window.electron.settings.update(settings);
      if (result.success) {
        setHasChanges(false);
      }
    } catch (error) {
      // Handle error silently in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Error saving settings:', error);
      }
    }
  };

  const handleReset = () => {
    const confirmReset = window.confirm(
      'Are you sure you want to reset all settings to defaults? This action cannot be undone.',
    );
    if (confirmReset) {
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
        reader.onload = (event) => {
          try {
            const importedSettings = JSON.parse(event.target?.result as string);
            setSettings((prev) => ({ ...prev, ...importedSettings }));
            setHasChanges(true);
          } catch {
            // Show error in a more user-friendly way
            setHasChanges(false); // Reset changes if import failed
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
          onChange={(e) =>
            handleSettingChange(
              'maxBackgroundProcesses',
              parseInt(e.target.value, 10),
            )
          }
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
          onChange={(e) => handleSettingChange('cacheSize', parseInt(e.target.value, 10))}
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

  const renderNotificationsSettings = () => (
    <div className="settings-section">
      <h3>Notification Settings</h3>

      <div className="setting-group">
        <h4>Event Notifications</h4>

        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptEvents ?? true}
            onChange={(e) => handleNotificationSettingChange('scriptEvents', e.target.checked)}
          />
          <span className="setting-checkbox-label">Script Events</span>
        </label>
        <p className="setting-description">
          Show notifications when scripts start, complete, or encounter issues
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.projectEvents ?? true}
            onChange={(e) => handleNotificationSettingChange('projectEvents', e.target.checked)}
          />
          <span className="setting-checkbox-label">Project Events</span>
        </label>
        <p className="setting-description">
          Show notifications when projects are added, removed, or their environment changes
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.systemEvents ?? true}
            onChange={(e) => handleNotificationSettingChange('systemEvents', e.target.checked)}
          />
          <span className="setting-checkbox-label">System Events</span>
        </label>
        <p className="setting-description">
          Show notifications for system-level events and application status changes
        </p>
      </div>

      <div className="setting-group">
        <h4>Detailed Script Notifications</h4>

        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptCompletion ?? true}
            onChange={(e) => handleNotificationSettingChange('scriptCompletion', e.target.checked)}
          />
          <span className="setting-checkbox-label">Script Completion</span>
        </label>
        <p className="setting-description">
          Show notification when scripts complete successfully
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptErrors ?? true}
            onChange={(e) => handleNotificationSettingChange('scriptErrors', e.target.checked)}
          />
          <span className="setting-checkbox-label">Script Errors</span>
        </label>
        <p className="setting-description">
          Show notification when scripts encounter errors
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptWarnings ?? true}
            onChange={(e) => handleNotificationSettingChange('scriptWarnings', e.target.checked)}
          />
          <span className="setting-checkbox-label">Script Warnings</span>
        </label>
        <p className="setting-description">
          Show notification when scripts output warnings
        </p>
      </div>

      <div className="setting-group">
        <h4>System Tray</h4>

        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.minimizeToTray ?? true}
            onChange={(e) => handleNotificationSettingChange('minimizeToTray', e.target.checked)}
          />
          <span className="setting-checkbox-label">Minimize to Tray</span>
        </label>
        <p className="setting-description">
          Minimize the application to system tray instead of closing
        </p>
      </div>
    </div>
  );

  const renderBackgroundSettings = () => (
    <div className="settings-section">
      <h3>Background Operation Settings</h3>

      <div className="setting-group">
        <h4>Background Mode</h4>

        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.backgroundOperation?.enableMinimalMode ?? true}
            onChange={(e) => handleBackgroundSettingChange('enableMinimalMode', e.target.checked)}
          />
          <span className="setting-checkbox-label">Enable Minimal Mode</span>
        </label>
        <p className="setting-description">
          When active, allows the application to run in the background with minimal resource usage
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.backgroundOperation?.continueBackgroundTasks ?? true}
            onChange={(e) => handleBackgroundSettingChange('continueBackgroundTasks', e.target.checked)}
          />
          <span className="setting-checkbox-label">Continue Background Tasks</span>
        </label>
        <p className="setting-description">
          Continue running tasks like Git polling when minimized to tray
        </p>
      </div>

      <div className="setting-group">
        <h4>Resource Limits</h4>

        <label className="setting-item">
          <span>Background Task Limit:</span>
          <input
            type="number"
            min="1"
            max="50"
            value={settings.backgroundOperation?.backgroundTaskLimit ?? 10}
            onChange={(e) =>
              handleBackgroundSettingChange(
                'backgroundTaskLimit',
                parseInt(e.target.value, 10),
              )
            }
          />
        </label>
        <p className="setting-description">
          Maximum number of background tasks allowed to run simultaneously
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-item">
          <span>CPU Limit (%):</span>
          <input
            type="number"
            min="5"
            max="90"
            value={settings.backgroundOperation?.resourceLimitCpuPercent ?? 25}
            onChange={(e) =>
              handleBackgroundSettingChange(
                'resourceLimitCpuPercent',
                parseInt(e.target.value, 10),
              )
            }
          />
        </label>
        <p className="setting-description">
          Maximum CPU usage allowed for background processes
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-item">
          <span>Memory Limit (MB):</span>
          <input
            type="number"
            min="100"
            max="2000"
            value={settings.backgroundOperation?.resourceLimitMemoryMb ?? 500}
            onChange={(e) =>
              handleBackgroundSettingChange(
                'resourceLimitMemoryMb',
                parseInt(e.target.value, 10),
              )
            }
          />
        </label>
        <p className="setting-description">
          Maximum memory usage allowed for background processes
        </p>
      </div>

      <div className="setting-group">
        <h4>Polling Intervals</h4>

        <label className="setting-item">
          <span>Git Polling (seconds):</span>
          <input
            type="number"
            min="5"
            max="600"
            value={settings.backgroundOperation?.gitPollingInterval ?? 30}
            onChange={(e) =>
              handleBackgroundSettingChange(
                'gitPollingInterval',
                parseInt(e.target.value, 10),
              )
            }
          />
        </label>
        <p className="setting-description">
          How often to check repositories for changes
        </p>
      </div>

      <div className="setting-group">
        <label className="setting-item">
          <span>File Watching Throttle (ms):</span>
          <input
            type="number"
            min="100"
            max="5000"
            value={settings.backgroundOperation?.fileWatchingThrottle ?? 1000}
            onChange={(e) =>
              handleBackgroundSettingChange(
                'fileWatchingThrottle',
                parseInt(e.target.value, 10),
              )
            }
          />
        </label>
        <p className="setting-description">
          Throttle delay for file system watching events
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
      case 'notifications': return renderNotificationsSettings();
      case 'background': return renderBackgroundSettings();
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
