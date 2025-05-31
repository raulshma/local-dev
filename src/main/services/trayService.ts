import { Tray, Menu, MenuItemConstructorOptions, app, BrowserWindow, nativeImage, Notification } from 'electron';
import path from 'path';
import { Project } from '../../types';

interface NotificationSettings {
  scriptEvents: boolean;
  projectEvents: boolean;
  systemEvents: boolean;
  scriptCompletion: boolean;
  scriptErrors: boolean;
  scriptWarnings: boolean;
}

export class TrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private projects: Project[] = [];
  private runningScripts: Set<string> = new Set();
  private isQuiting = false;
  private notificationSettings: NotificationSettings = {
    scriptEvents: true,
    projectEvents: true,
    systemEvents: true,
    scriptCompletion: true,
    scriptErrors: true,
    scriptWarnings: true,
  };

  constructor() {
    this.setupTray();

    // Handle app before-quit event
    app.on('before-quit', () => {
      this.isQuiting = true;
    });
  }

  private setupTray() {
    // Create tray icon - use the app icon or a simplified version
    const iconPath = this.getTrayIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    // Resize icon for tray (16x16 or 20x20 depending on platform)
    const trayIcon = icon.resize({ width: 16, height: 16 });

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Local Dev Environment');

    // Set up context menu
    this.updateContextMenu();

    // Handle double-click to show/hide window
    this.tray.on('double-click', () => {
      this.toggleMainWindow();
    });
  }

  private getTrayIconPath(): string {
    // Use the existing app icon from assets
    const assetsPath = path.join(__dirname, '../../../assets');

    if (process.platform === 'win32') {
      return path.join(assetsPath, 'icon.ico');
    } else if (process.platform === 'darwin') {
      return path.join(assetsPath, 'icon.icns');
    } else {
      return path.join(assetsPath, 'icon.png');
    }
  }
  private updateContextMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: this.mainWindow?.isVisible() ? 'Hide Window' : 'Show Local Dev Environment',
        click: () => {
          if (this.mainWindow?.isVisible()) {
            this.enableMinimalMode();
          } else {
            this.restoreFromMinimalMode();
          }
        }
      },
      {
        type: 'separator'
      },
      // Recent projects section
      ...this.buildRecentProjectsMenu(),
      {
        type: 'separator'
      },
      // Running scripts indicator
      this.buildRunningScriptsItem(),
      {
        type: 'separator'
      },
      {
        label: 'Background Tasks',
        submenu: [
          {
            label: 'Show Status',
            click: () => {
              this.showMainWindow();
              // Send IPC to focus background tab
              this.mainWindow?.webContents.send('show-background-status');
            }
          },
          {
            type: 'separator'
          },
          {
            label: 'Restart Background Tasks',
            click: () => {
              // Send IPC to restart background tasks
              this.mainWindow?.webContents.send('restart-background-tasks');
            }
          }
        ]
      },
      {
        label: 'Preferences...',
        click: () => {
          this.showMainWindow();
          // Could send IPC to open settings page
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit Local Dev Environment',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray?.setContextMenu(contextMenu);
  }
  private buildRecentProjectsMenu(): MenuItemConstructorOptions[] {
    if (this.projects.length === 0) {
      return [
        {
          label: 'No recent projects',
          enabled: false
        }
      ];
    }

    // Get the 5 most recently accessed projects
    const recentProjects = this.projects
      .filter(p => p.lastAccessed)
      .sort((a, b) => {
        const dateA = new Date(a.lastAccessed!).getTime();
        const dateB = new Date(b.lastAccessed!).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);

    if (recentProjects.length === 0) {
      return [
        {
          label: 'No recent projects',
          enabled: false
        }
      ];
    }

    const projectMenuItems: MenuItemConstructorOptions[] = [
      {
        label: 'Recent Projects',
        enabled: false
      }
    ];

    recentProjects.forEach(project => {
      projectMenuItems.push({
        label: `  ${project.name}`,
        click: () => {
          this.showMainWindow();
          this.selectProject(project.id);
        }
      });
    });

    return projectMenuItems;
  }

  private buildRunningScriptsItem(): MenuItemConstructorOptions {
    const runningCount = this.runningScripts.size;

    if (runningCount === 0) {
      return {
        label: 'No scripts running',
        enabled: false
      };
    }

    return {
      label: `${runningCount} script${runningCount > 1 ? 's' : ''} running`,
      click: () => {
        this.showMainWindow();
      }
    };
  }

  public setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;    if (window) {
      // Handle window minimize to tray
      window.on('minimize', () => {
        if (this.shouldMinimizeToTray()) {
          window.hide();

          // Show notification on first minimize
          if (!this.hasShownMinimizeNotification()) {
            this.tray?.displayBalloon({
              iconType: 'info',
              title: 'Local Dev Environment',
              content: 'Application was minimized to tray. Double-click the tray icon to restore.'
            });
            this.setMinimizeNotificationShown();
          }
        }
      });

      // Handle window close
      window.on('close', (event: Electron.Event) => {
        if (this.shouldMinimizeToTray() && !this.isQuiting) {
          event.preventDefault();
          window.hide();
        }
      });
    }
  }

  private shouldMinimizeToTray(): boolean {
    // Could be configurable in settings later
    return true;
  }

  private hasShownMinimizeNotification(): boolean {
    // Simple check - could use persistent storage
    return (global as any).trayNotificationShown || false;
  }

  private setMinimizeNotificationShown() {
    (global as any).trayNotificationShown = true;
  }

  private showMainWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  private toggleMainWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.showMainWindow();
      }
    }
  }

  private selectProject(projectId: string) {
    // Send IPC message to renderer to select project
    if (this.mainWindow) {
      this.mainWindow.webContents.send('tray:select-project', projectId);
    }
  }

  public updateProjects(projects: Project[]) {
    this.projects = projects;
    this.updateContextMenu();
  }

  public updateRunningScripts(runningScripts: Set<string>) {
    this.runningScripts = runningScripts;
    this.updateTrayIcon();
    this.updateContextMenu();
  }

  private updateTrayIcon() {
    if (!this.tray) return;

    const iconPath = this.getTrayIconPath();
    let icon = nativeImage.createFromPath(iconPath);

    // Change icon based on running scripts status
    if (this.runningScripts.size > 0) {
      // Add a green overlay or use a different icon to indicate activity
      // For now, we'll just update the tooltip
      this.tray.setToolTip(`Local Dev Environment - ${this.runningScripts.size} script${this.runningScripts.size > 1 ? 's' : ''} running`);
    } else {
      this.tray.setToolTip('Local Dev Environment');
    }    const trayIcon = icon.resize({ width: 16, height: 16 });
    this.tray.setImage(trayIcon);
  }

  public addRunningScript(name: string, command: string, pid?: number) {
    this.runningScripts.add(name);
    this.updateTrayIcon();
    this.updateContextMenu();
  }
  public removeRunningScript(name: string) {
    this.runningScripts.delete(name);
    this.updateTrayIcon();
    this.updateContextMenu();
  }

  // Notification methods
  public updateNotificationSettings(settings: Partial<NotificationSettings>) {
    this.notificationSettings = { ...this.notificationSettings, ...settings };
  }

  public getNotificationSettings(): NotificationSettings {
    return { ...this.notificationSettings };
  }

  private showNotification(title: string, body: string, silent = false) {
    if (!Notification.isSupported()) {
      console.log('Notifications not supported on this platform');
      return;
    }

    try {
      const notification = new Notification({
        title,
        body,
        silent,
        icon: this.getTrayIconPath(),
      });

      notification.on('click', () => {
        this.showMainWindow();
      });

      notification.show();
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  // Script event notifications
  public notifyScriptStarted(projectName: string, scriptName: string) {
    if (!this.notificationSettings.scriptEvents) return;

    this.showNotification(
      'Script Started',
      `"${scriptName}" started in ${projectName}`,
      true // Silent for start events
    );
  }

  public notifyScriptCompleted(projectName: string, scriptName: string, duration?: number) {
    if (!this.notificationSettings.scriptEvents || !this.notificationSettings.scriptCompletion) return;

    const durationText = duration ? ` (${Math.round(duration / 1000)}s)` : '';
    this.showNotification(
      'Script Completed',
      `"${scriptName}" completed in ${projectName}${durationText}`
    );
  }

  public notifyScriptError(projectName: string, scriptName: string, error?: string) {
    if (!this.notificationSettings.scriptEvents || !this.notificationSettings.scriptErrors) return;

    this.showNotification(
      'Script Failed',
      `"${scriptName}" failed in ${projectName}${error ? ': ' + error : ''}`
    );
  }

  public notifyScriptWarning(projectName: string, scriptName: string, warning: string) {
    if (!this.notificationSettings.scriptEvents || !this.notificationSettings.scriptWarnings) return;

    this.showNotification(
      'Script Warning',
      `"${scriptName}" in ${projectName}: ${warning}`
    );
  }

  // Project event notifications
  public notifyProjectAdded(projectName: string) {
    if (!this.notificationSettings.projectEvents) return;

    this.showNotification(
      'Project Added',
      `"${projectName}" has been added to your workspace`
    );
  }

  public notifyProjectRemoved(projectName: string) {
    if (!this.notificationSettings.projectEvents) return;

    this.showNotification(
      'Project Removed',
      `"${projectName}" has been removed from your workspace`
    );
  }

  public notifyEnvironmentChanged(projectName: string, configName: string) {
    if (!this.notificationSettings.projectEvents) return;

    this.showNotification(
      'Environment Changed',
      `Environment configuration "${configName}" updated in ${projectName}`,
      true // Silent for environment changes
    );
  }
  // System event notifications
  public notifySystemEvent(title: string, message: string) {
    if (!this.notificationSettings.systemEvents) return;

    this.showNotification(title, message);
  }

  public enableMinimalMode(backgroundTaskService?: any) {
    if (this.mainWindow) {
      this.mainWindow.hide();

      // Start background tasks if provided
      if (backgroundTaskService) {
        backgroundTaskService.setMinimalMode(true);
      }

      this.showNotification('Minimal Mode', 'Application minimized to tray. Background tasks continue running.');
    }
  }

  public restoreFromMinimalMode(backgroundTaskService?: any) {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();

      // Update background task service
      if (backgroundTaskService) {
        backgroundTaskService.setMinimalMode(false);
      }
    }
  }

  public setupMinimizeToTray(window: BrowserWindow, backgroundTaskService?: any) {
    window.on('close', (event) => {
      if (!this.isQuiting) {
        event.preventDefault();
        this.enableMinimalMode(backgroundTaskService);
      }
    });

    window.on('minimize', () => {
      // Optional: also minimize to tray on minimize button
      this.enableMinimalMode(backgroundTaskService);
    });
  }

  public destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
