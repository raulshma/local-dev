import { EventEmitter } from 'events';
import { Project, AppSettings } from '../../types';
import { GitService } from './gitService';
import StoreService from './store';

interface BackgroundTaskConfig {
  enableMinimalMode: boolean;
  continueBackgroundTasks: boolean;
  backgroundTaskLimit: number;
  resourceLimitCpuPercent: number;
  resourceLimitMemoryMb: number;
  gitPollingInterval: number;
  fileWatchingThrottle: number;
}

export class BackgroundTaskService extends EventEmitter {
  private config: BackgroundTaskConfig;
  private storeService: StoreService;
  private resourceMonitor?: NodeJS.Timeout;
  private gitPollingInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(storeService: StoreService) {
    super();
    this.storeService = storeService;

    // Default configuration
    this.config = {
      enableMinimalMode: true,
      continueBackgroundTasks: true,
      backgroundTaskLimit: 10,
      resourceLimitCpuPercent: 25,
      resourceLimitMemoryMb: 500,
      gitPollingInterval: 30, // 30 seconds
      fileWatchingThrottle: 1000, // 1 second
    };

    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const settings = await this.storeService.getSettings();
      if (settings.backgroundOperation) {
        this.config = {
          ...this.config,
          ...settings.backgroundOperation,
        };
      }
    } catch (error) {
      console.error('Error loading background task settings:', error);
    }
  }

  public updateSettings(settings: AppSettings) {
    if (settings.backgroundOperation) {
      this.config = {
        ...this.config,
        ...settings.backgroundOperation,
      };

      // Restart tasks with new configuration
      if (this.isRunning) {
        this.restart();
      }
    }
  }

  public start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('started');

    // Start resource monitoring
    this.startResourceMonitoring();

    // Start Git polling for all projects
    this.startGitPolling();
  }

  public stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Stop resource monitoring
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = undefined;
    }

    // Stop Git polling
    if (this.gitPollingInterval) {
      clearInterval(this.gitPollingInterval);
      this.gitPollingInterval = undefined;
    }

    this.emit('stopped');
  }

  public restart() {
    this.stop();
    this.start();
  }

  private startResourceMonitoring() {
    this.resourceMonitor = setInterval(() => {
      this.checkResourceUsage();
    }, 10000); // Check every 10 seconds
  }

  private startGitPolling() {
    this.gitPollingInterval = setInterval(async () => {
      try {
        const projects = await this.storeService.getProjects();
        for (const project of projects) {
          await this.pollGitChanges(project);
        }
      } catch (error) {
        console.error('Error in git polling:', error);
      }
    }, this.config.gitPollingInterval * 1000);
  }

  private async pollGitChanges(project: Project) {
    try {
      const isGitRepo = await GitService.isGitRepository(project.path);
      if (!isGitRepo) return;

      const gitStatus = await GitService.getGitStatus(project.path);

      // Emit events for Git changes
      if (gitStatus.hasUncommittedChanges) {
        this.emit('git-changes-detected', {
          projectId: project.id,
          changes: gitStatus,
          branch: gitStatus.currentBranch,
        });
      }

      // Check for remote changes
      if (gitStatus.ahead > 0 || gitStatus.behind > 0) {
        this.emit('git-remote-changes', {
          projectId: project.id,
          ahead: gitStatus.ahead,
          behind: gitStatus.behind,
        });
      }
    } catch (error) {
      // Git polling errors are common (network issues, no remote, etc.)
      // Just log silently
      console.debug(`Git polling error for ${project.id}:`, (error as Error).message);
    }
  }

  private checkResourceUsage() {
    try {
      const memUsage = process.memoryUsage();
      const memUsageMb = memUsage.heapUsed / 1024 / 1024;

      // Check memory limit
      if (memUsageMb > this.config.resourceLimitMemoryMb) {
        this.emit('resource-limit-exceeded', {
          type: 'memory',
          usage: memUsageMb,
          limit: this.config.resourceLimitMemoryMb,
        });
      }

      this.emit('resource-status', {
        memoryUsageMb: memUsageMb,
        isRunning: this.isRunning,
      });
    } catch (error) {
      console.error('Error checking resource usage:', error);
    }
  }

  public getTaskStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }

  public setMinimalMode(enabled: boolean) {
    this.config.enableMinimalMode = enabled;

    if (enabled && !this.isRunning) {
      this.start();
    } else if (!enabled && this.isRunning) {
      this.stop();
    }
  }
}
