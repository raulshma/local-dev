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

function SettingsPage({ onClose }: SettingsPageProps): JSX.Element {
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

  const loadSettings = async (): Promise<void> => {
    try {
      const result = await window.electron.ipcRenderer.invoke('get-settings');
      if (result.success) {
        setSettings((prev) => ({ ...prev, ...result.settings }));
      }
    } catch (error) {
      // Silent error handling - could be logged to a service
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: any): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleNotificationSettingChange = (
    key: keyof NonNullable<AppSettings['notifications']>,
    value: boolean,
  ): void => {
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
  ): void => {
    setSettings((prev) => ({
      ...prev,
      backgroundOperation: {
        ...prev.backgroundOperation,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const saveSettings = async (): Promise<void> => {
    try {
      const result = await window.electron.ipcRenderer.invoke('save-settings', settings);
      if (result.success) {
        setHasChanges(false);
      }
    } catch (error) {
      // Silent error handling - could be logged to a service
    }
  };

  const resetSettings = (): void => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all settings to defaults? This action cannot be undone.',
    );
    if (confirmed) {
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
      setHasChanges(true);
    }
  };

  const exportSettings = (): void => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = 'local-dev-settings.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const importedSettings = JSON.parse(loadEvent.target?.result as string);
          setSettings((prev) => ({ ...prev, ...importedSettings }));
          setHasChanges(true);
        } catch {
          alert('Invalid settings file format');
        }
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const renderGeneralSettings = (): JSX.Element => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-label" htmlFor="startup-behavior">
          Startup Behavior
        </label>
        <select
          id="startup-behavior"
          value={settings.startupBehavior}
          onChange={(e) =>
            handleSettingChange('startupBehavior', e.target.value)
          }
        >
          <option value="last-state">Restore last state</option>
          <option value="empty">Start empty</option>
          <option value="dashboard">Show dashboard</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.autoUpdate}
            onChange={(e) =>
              handleSettingChange('autoUpdate', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">
            Enable automatic updates
          </span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.checkForUpdatesOnStartup}
            onChange={(e) =>
              handleSettingChange('checkForUpdatesOnStartup', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">
            Check for updates on startup
          </span>
        </label>
      </div>
    </div>
  );

  const renderAppearanceSettings = (): JSX.Element => (
    <div className="settings-section">
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
              <span className="theme-option-label">{theme.label}</span>
              <span className="theme-option-description">
                {theme.description}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="font-size">
          Font Size
        </label>
        <select
          id="font-size"
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
            onChange={(e) =>
              handleSettingChange('compactMode', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Compact mode</span>
        </label>
      </div>
    </div>
  );

  const renderIntegrationSettings = (): JSX.Element => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-label" htmlFor="ide-command">
          IDE Command
        </label>
        <input
          id="ide-command"
          type="text"
          value={settings.ideCommand}
          onChange={(e) => handleSettingChange('ideCommand', e.target.value)}
        />
        <div className="setting-description">
          Command to launch your preferred IDE. Examples: code (VS Code), idea
          (IntelliJ), subl (Sublime)
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="terminal-command">
          Terminal Command
        </label>
        <input
          id="terminal-command"
          type="text"
          value={settings.terminalCommand}
          onChange={(e) =>
            handleSettingChange('terminalCommand', e.target.value)
          }
        />
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="git-client-command">
          Git Client Command
        </label>
        <input
          id="git-client-command"
          type="text"
          value={settings.gitClientCommand}
          onChange={(e) =>
            handleSettingChange('gitClientCommand', e.target.value)
          }
        />
      </div>
    </div>
  );

  const renderNotificationsSettings = (): JSX.Element => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptEvents ?? true}
            onChange={(e) =>
              handleNotificationSettingChange('scriptEvents', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Script events</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.projectEvents ?? true}
            onChange={(e) =>
              handleNotificationSettingChange('projectEvents', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Project events</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.systemEvents ?? true}
            onChange={(e) =>
              handleNotificationSettingChange('systemEvents', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">System events</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptCompletion ?? true}
            onChange={(e) =>
              handleNotificationSettingChange('scriptCompletion', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Script completion</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptErrors ?? true}
            onChange={(e) =>
              handleNotificationSettingChange('scriptErrors', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Script errors</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.scriptWarnings ?? true}
            onChange={(e) =>
              handleNotificationSettingChange('scriptWarnings', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Script warnings</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications?.minimizeToTray ?? true}
            onChange={(e) =>
              handleNotificationSettingChange('minimizeToTray', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Minimize to tray</span>
        </label>
      </div>
    </div>
  );

  const renderBackgroundSettings = (): JSX.Element => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.backgroundOperation?.enableMinimalMode ?? false}
            onChange={(e) =>
              handleBackgroundSettingChange('enableMinimalMode', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Enable minimal mode</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.backgroundOperation?.continueBackgroundTasks ?? false}
            onChange={(e) =>
              handleBackgroundSettingChange('continueBackgroundTasks', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Continue background tasks</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="background-task-limit">
          Background task limit
        </label>
        <input
          id="background-task-limit"
          type="number"
          min="1"
          max="20"
          value={settings.backgroundOperation?.backgroundTaskLimit ?? 5}
          onChange={(e) =>
            handleBackgroundSettingChange('backgroundTaskLimit', parseInt(e.target.value, 10))
          }
        />
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="cpu-limit">
          CPU limit (%)
        </label>
        <input
          id="cpu-limit"
          type="number"
          min="1"
          max="100"
          value={settings.backgroundOperation?.resourceLimitCpuPercent ?? 50}
          onChange={(e) =>
            handleBackgroundSettingChange('resourceLimitCpuPercent', parseInt(e.target.value, 10))
          }
        />
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="memory-limit">
          Memory limit (MB)
        </label>
        <input
          id="memory-limit"
          type="number"
          min="100"
          max="2000"
          value={settings.backgroundOperation?.resourceLimitMemoryMb ?? 500}
          onChange={(e) =>
            handleBackgroundSettingChange('resourceLimitMemoryMb', parseInt(e.target.value, 10))
          }
        />
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="git-polling-interval">
          Git polling interval (seconds)
        </label>
        <input
          id="git-polling-interval"
          type="number"
          min="5"
          max="300"
          value={settings.backgroundOperation?.gitPollingInterval ?? 30}
          onChange={(e) =>
            handleBackgroundSettingChange('gitPollingInterval', parseInt(e.target.value, 10))
          }
        />
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="file-watching-throttle">
          File watching throttle (ms)
        </label>
        <input
          id="file-watching-throttle"
          type="number"
          min="100"
          max="5000"
          value={settings.backgroundOperation?.fileWatchingThrottle ?? 1000}
          onChange={(e) =>
            handleBackgroundSettingChange('fileWatchingThrottle', parseInt(e.target.value, 10))
          }
        />
      </div>
    </div>
  );

  const renderPerformanceSettings = (): JSX.Element => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-label" htmlFor="max-background-processes">
          Max Background Processes
        </label>
        <input
          id="max-background-processes"
          type="number"
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
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.enableFileWatching}
            onChange={(e) =>
              handleSettingChange('enableFileWatching', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Enable file watching</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="cache-size">
          Cache Size (MB)
        </label>
        <input
          id="cache-size"
          type="number"
          min="10"
          max="1000"
          value={settings.cacheSize}
          onChange={(e) =>
            handleSettingChange('cacheSize', parseInt(e.target.value, 10))
          }
        />
      </div>
    </div>
  );

  const renderSecuritySettings = (): JSX.Element => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.restrictProjectPaths}
            onChange={(e) =>
              handleSettingChange('restrictProjectPaths', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">
            Restrict project paths
          </span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.enableSafeMode}
            onChange={(e) =>
              handleSettingChange('enableSafeMode', e.target.checked)
            }
          />
          <span className="setting-checkbox-label">Enable safe mode</span>
        </label>
      </div>
    </div>
  );

  const renderContent = (): JSX.Element => {
    switch (activeCategory) {
      case 'general':
        return renderGeneralSettings();
      case 'appearance':
        return renderAppearanceSettings();
      case 'integrations':
        return renderIntegrationSettings();
      case 'notifications':
        return renderNotificationsSettings();
      case 'background':
        return renderBackgroundSettings();
      case 'performance':
        return renderPerformanceSettings();
      case 'security':
        return renderSecuritySettings();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-title">
          <SettingsIcon />
          Settings
        </div>
        <button className="settings-close-btn" onClick={onClose} type="button">
          <CloseIcon />
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-sidebar">
          <div className="settings-categories">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`category-item ${
                  activeCategory === category.id ? 'active' : ''
                }`}
                onClick={() => setActiveCategory(category.id)}
                type="button"
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-label">{category.label}</span>
                <ChevronRightIcon />
              </button>
            ))}
          </div>

          <div className="settings-actions">
            <button
              className="action-button primary"
              onClick={saveSettings}
              disabled={!hasChanges}
              type="button"
            >
              Save Changes
            </button>
            <button
              className="action-button"
              onClick={resetSettings}
              type="button"
            >
              Reset to Defaults
            </button>
            <button
              className="action-button"
              onClick={exportSettings}
              type="button"
            >
              Export Settings
            </button>
            <label className="action-button file-input-label">
              Import Settings
              <input
                type="file"
                accept=".json"
                onChange={importSettings}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div className="settings-footer">
            <label className="expert-mode-toggle">
              <input
                type="checkbox"
                checked={expertMode}
                onChange={(e) => setExpertMode(e.target.checked)}
              />
              <span>Expert Mode</span>
            </label>
          </div>
        </div>

        <div className="settings-main">
          <div className="settings-category-title">
            {categories.find((cat) => cat.id === activeCategory)?.label}
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
