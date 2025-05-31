import React, { useState, useEffect } from 'react';
import { SettingsIcon, CloseIcon, ChevronRightIcon, SearchIcon } from './Icons';
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
  const [searchQuery, setSearchQuery] = useState('');
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
    { id: 'general', label: 'General', icon: 'gear', description: 'Startup behavior and application settings' },
    { id: 'appearance', label: 'Appearance', icon: 'palette', description: 'Theme, font size, and UI customization' },
    { id: 'integrations', label: 'Integrations', icon: 'plug', description: 'IDE, terminal, and Git client configuration' },
    { id: 'notifications', label: 'Notifications', icon: 'bell', description: 'Event notifications and system tray settings' },
    { id: 'background', label: 'Background', icon: 'clock', description: 'Background tasks and resource management' },
    { id: 'performance', label: 'Performance', icon: 'zap', description: 'Performance optimizations and resource limits' },
    { id: 'security', label: 'Security', icon: 'shield', description: 'Security settings and path restrictions' },
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

  // Filter categories based on search query
  const filteredCategories = categories.filter(category =>
    category.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="section-header">
        <h3>General</h3>
        <p className="section-description">Configure startup behavior and application settings</p>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Startup Behavior</label>
            <p className="setting-description">Choose what happens when the application starts</p>
          </div>
          <select
            className="setting-control setting-select"
            value={settings.startupBehavior}
            onChange={(e) => handleSettingChange('startupBehavior', e.target.value)}
          >
            <option value="last-state">Restore last state</option>
            <option value="empty">Start with no projects</option>
            <option value="dashboard">Always show dashboard</option>
          </select>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Automatic Updates</label>
            <p className="setting-description">Automatically download and install updates when available</p>
          </div>
          <label className="setting-control setting-checkbox">
            <input
              type="checkbox"
              checked={settings.autoUpdate}
              onChange={(e) => handleSettingChange('autoUpdate', e.target.checked)}
            />
            <span className="checkbox-label">Enable automatic updates</span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Update Check on Startup</label>
            <p className="setting-description">Check for available updates when the application starts</p>
          </div>
          <label className="setting-control setting-checkbox">
            <input
              type="checkbox"
              checked={settings.checkForUpdatesOnStartup}
              onChange={(e) => handleSettingChange('checkForUpdatesOnStartup', e.target.checked)}
            />
            <span className="checkbox-label">Check for updates on startup</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Appearance</h3>
        <p className="section-description">Customize the look and feel of the application</p>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Color Theme</label>
            <p className="setting-description">Select the color theme for the interface</p>
          </div>
          <div className="theme-grid">
            {themes.map((theme) => (
              <label key={theme.id} className="theme-card">
                <input
                  type="radio"
                  name="theme"
                  value={theme.id}
                  checked={settings.theme === theme.id}
                  onChange={(e) => handleSettingChange('theme', e.target.value)}
                />
                <div className="theme-preview">
                  <div className={`theme-sample theme-sample-${theme.id}`} />
                </div>
                <div className="theme-info">
                  <span className="theme-name">{theme.label}</span>
                  <span className="theme-desc">{theme.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Font Size</label>
            <p className="setting-description">Adjust the size of text throughout the application</p>
          </div>
          <select
            className="setting-control setting-select"
            value={settings.fontSize}
            onChange={(e) => handleSettingChange('fontSize', e.target.value)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium (Recommended)</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Compact Mode</label>
            <p className="setting-description">Use a more compact layout to fit more content on screen</p>
          </div>
          <label className="setting-control setting-checkbox">
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
            />
            <span className="checkbox-label">Enable compact mode</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderIntegrationsSettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Integrations</h3>
        <p className="section-description">Configure external tools and command-line integrations</p>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">IDE Command</label>
            <p className="setting-description">
              Command to launch your preferred IDE. Examples: code (VS Code), idea (IntelliJ), subl (Sublime Text)
            </p>
          </div>
          <input
            type="text"
            className="setting-control setting-input"
            value={settings.ideCommand}
            onChange={(e) => handleSettingChange('ideCommand', e.target.value)}
            placeholder="e.g., code, idea, subl"
          />
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Terminal Command</label>
            <p className="setting-description">
              Command to launch your preferred terminal application
            </p>
          </div>
          <input
            type="text"
            className="setting-control setting-input"
            value={settings.terminalCommand}
            onChange={(e) => handleSettingChange('terminalCommand', e.target.value)}
            placeholder="e.g., powershell.exe, cmd.exe, wt.exe"
          />
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Git Client Command</label>
            <p className="setting-description">
              Command to launch your preferred Git client
            </p>
          </div>
          <input
            type="text"
            className="setting-control setting-input"
            value={settings.gitClientCommand}
            onChange={(e) => handleSettingChange('gitClientCommand', e.target.value)}
            placeholder="e.g., git, github-desktop, sourcetree"
          />
        </div>
      </div>
    </div>
  );

  const renderPerformanceSettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Performance</h3>
        <p className="section-description">Optimize performance and manage system resources</p>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Max Background Processes</label>
            <p className="setting-description">
              Maximum number of concurrent background processes (1-20)
            </p>
          </div>
          <input
            type="number"
            className="setting-control setting-input"
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

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">File Watching</label>
            <p className="setting-description">
              Monitor project files for changes to auto-refresh project information
            </p>
          </div>
          <label className="setting-control setting-checkbox">
            <input
              type="checkbox"
              checked={settings.enableFileWatching}
              onChange={(e) => handleSettingChange('enableFileWatching', e.target.checked)}
            />
            <span className="checkbox-label">Enable file watching</span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Cache Size</label>
            <p className="setting-description">
              Amount of disk space to use for caching project data (10-1000 MB)
            </p>
          </div>
          <input
            type="number"
            className="setting-control setting-input"
            min="10"
            max="1000"
            value={settings.cacheSize}
            onChange={(e) => handleSettingChange('cacheSize', parseInt(e.target.value, 10))}
          />
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Security</h3>
        <p className="section-description">Configure security settings and access restrictions</p>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Project Path Restrictions</label>
            <p className="setting-description">
              Only allow projects from specified safe directories
            </p>
          </div>
          <label className="setting-control setting-checkbox">
            <input
              type="checkbox"
              checked={settings.restrictProjectPaths}
              onChange={(e) => handleSettingChange('restrictProjectPaths', e.target.checked)}
            />
            <span className="checkbox-label">Restrict project paths</span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Safe Mode</label>
            <p className="setting-description">
              Restrict potentially dangerous operations and require confirmation for script execution
            </p>
          </div>
          <label className="setting-control setting-checkbox">
            <input
              type="checkbox"
              checked={settings.enableSafeMode}
              onChange={(e) => handleSettingChange('enableSafeMode', e.target.checked)}
            />
            <span className="checkbox-label">Enable safe mode</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderNotificationsSettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Notifications</h3>
        <p className="section-description">Configure event notifications and system behavior</p>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Event Notifications</label>
            <p className="setting-description">Choose which events trigger notifications</p>
          </div>
          <div className="checkbox-group">
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications?.scriptEvents ?? true}
                onChange={(e) => handleNotificationSettingChange('scriptEvents', e.target.checked)}
              />
              <span className="checkbox-label">Script Events</span>
            </label>
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications?.projectEvents ?? true}
                onChange={(e) => handleNotificationSettingChange('projectEvents', e.target.checked)}
              />
              <span className="checkbox-label">Project Events</span>
            </label>
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications?.systemEvents ?? true}
                onChange={(e) => handleNotificationSettingChange('systemEvents', e.target.checked)}
              />
              <span className="checkbox-label">System Events</span>
            </label>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Script Notifications</label>
            <p className="setting-description">Detailed notifications for script execution</p>
          </div>
          <div className="checkbox-group">
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications?.scriptCompletion ?? true}
                onChange={(e) => handleNotificationSettingChange('scriptCompletion', e.target.checked)}
              />
              <span className="checkbox-label">Script Completion</span>
            </label>
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications?.scriptErrors ?? true}
                onChange={(e) => handleNotificationSettingChange('scriptErrors', e.target.checked)}
              />
              <span className="checkbox-label">Script Errors</span>
            </label>
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications?.scriptWarnings ?? true}
                onChange={(e) => handleNotificationSettingChange('scriptWarnings', e.target.checked)}
              />
              <span className="checkbox-label">Script Warnings</span>
            </label>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">System Tray</label>
            <p className="setting-description">Configure system tray behavior</p>
          </div>
          <label className="setting-control setting-checkbox">
            <input
              type="checkbox"
              checked={settings.notifications?.minimizeToTray ?? true}
              onChange={(e) => handleNotificationSettingChange('minimizeToTray', e.target.checked)}
            />
            <span className="checkbox-label">Minimize to tray instead of closing</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderBackgroundSettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Background Operations</h3>
        <p className="section-description">Configure background tasks and resource management</p>
      </div>

      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Background Mode</label>
            <p className="setting-description">Enable background operation settings</p>
          </div>
          <div className="checkbox-group">
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.backgroundOperation?.enableMinimalMode ?? true}
                onChange={(e) => handleBackgroundSettingChange('enableMinimalMode', e.target.checked)}
              />
              <span className="checkbox-label">Enable minimal mode when minimized</span>
            </label>
            <label className="setting-control setting-checkbox">
              <input
                type="checkbox"
                checked={settings.backgroundOperation?.continueBackgroundTasks ?? true}
                onChange={(e) => handleBackgroundSettingChange('continueBackgroundTasks', e.target.checked)}
              />
              <span className="checkbox-label">Continue background tasks when minimized</span>
            </label>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Resource Limits</label>
            <p className="setting-description">Set limits on system resource usage</p>
          </div>
          <div className="resource-controls">
            <div className="resource-control">
              <label className="resource-label">Background Task Limit:</label>
              <input
                type="number"
                className="setting-control setting-input resource-input"
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
            </div>
            <div className="resource-control">
              <label className="resource-label">CPU Limit (%):</label>
              <input
                type="number"
                className="setting-control setting-input resource-input"
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
            </div>
            <div className="resource-control">
              <label className="resource-label">Memory Limit (MB):</label>
              <input
                type="number"
                className="setting-control setting-input resource-input"
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
            </div>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">Polling Intervals</label>
            <p className="setting-description">Configure how often background tasks check for updates</p>
          </div>
          <div className="resource-controls">
            <div className="resource-control">
              <label className="resource-label">Git Polling (seconds):</label>
              <input
                type="number"
                className="setting-control setting-input resource-input"
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
            </div>
            <div className="resource-control">
              <label className="resource-label">File Watching Throttle (ms):</label>
              <input
                type="number"
                className="setting-control setting-input resource-input"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExpertMode = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Expert Configuration</h3>
        <p className="section-description">
          Direct JSON configuration editing. Be careful - invalid JSON may cause issues.
        </p>
      </div>

      <div className="settings-group">
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
            placeholder="Edit settings as JSON..."
          />
        </div>
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
          <div className="settings-search">
            <div className="search-box">
              <SearchIcon size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="settings-categories">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className={`settings-category ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(category.id);
                  setSearchQuery('');
                }}
              >
                <div className="category-content">
                  <div className="category-main">
                    <span className="category-label">{category.label}</span>
                    {searchQuery && (
                      <span className="category-match">"{searchQuery}"</span>
                    )}
                  </div>
                  <p className="category-description">{category.description}</p>
                </div>
                <ChevronRightIcon size={12} className="category-chevron" />
              </div>
            ))}
          </div>

          <div className="settings-actions">
            <div className="action-group">
              <button
                className={`settings-action ${expertMode ? 'active' : ''}`}
                onClick={() => setExpertMode(!expertMode)}
                title="Edit settings as JSON"
              >
                <span>Expert Mode</span>
              </button>
            </div>

            <div className="action-group">
              <button
                className="settings-action"
                onClick={handleImportSettings}
                title="Import settings from file"
              >
                Import Settings
              </button>
              <button
                className="settings-action"
                onClick={handleExportSettings}
                title="Export settings to file"
              >
                Export Settings
              </button>
            </div>

            <div className="action-group">
              <button
                className="settings-action danger"
                onClick={handleReset}
                title="Reset all settings to defaults"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>

        <div className="settings-main">
          <div className="settings-content-wrapper">
            {renderActiveSection()}
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <div className="settings-footer-left">
          {hasChanges && (
            <div className="changes-indicator">
              <span className="changes-dot"></span>
              <span>Unsaved changes</span>
            </div>
          )}
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
