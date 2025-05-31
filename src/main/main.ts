/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { spawn, ChildProcess, exec, execSync } from 'child_process';
import fs from 'fs/promises';
import { existsSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';
import os from 'os';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import StoreService from './services/store';
import { ProjectDetectionService } from './services/projectDetection';
import { GitService } from './services/gitService';
import { DockerService } from './services/dockerService';
import { TrayService } from './services/trayService';
import TerminalService from './services/terminalService';
import { AppSettings, ScriptExecutionHistory, EnvironmentConfiguration, Project, ProjectScript, ScriptStatus, ScriptOutput, ProjectSettings } from '../types';
import { BackgroundTaskService } from './services/backgroundTaskService';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let storeService: StoreService;
let projectDetectionService: ProjectDetectionService;
let trayService: TrayService;
let backgroundTaskService: BackgroundTaskService;
let terminalService: TerminalService;

// Track running processes
const runningProcesses = new Map<string, ChildProcess>();

// Track script execution history (in memory for now, could be persisted later)
const scriptExecutionHistory = new Map<string, ScriptExecutionHistory[]>(); // projectId -> history array

// Helper functions for script execution history
const addScriptExecutionHistory = (historyEntry: ScriptExecutionHistory) => {
  const projectHistory = scriptExecutionHistory.get(historyEntry.projectId) || [];
  projectHistory.unshift(historyEntry); // Add to beginning for latest first

  // Keep only last 100 executions per project to prevent memory bloat
  if (projectHistory.length > 100) {
    projectHistory.splice(100);
  }

  scriptExecutionHistory.set(historyEntry.projectId, projectHistory);
};

const updateScriptExecutionHistory = (
  projectId: string,
  historyId: string,
  updates: Partial<ScriptExecutionHistory>
) => {
  const projectHistory = scriptExecutionHistory.get(projectId) || [];
  const historyIndex = projectHistory.findIndex(h => h.id === historyId);

  if (historyIndex !== -1) {
    projectHistory[historyIndex] = { ...projectHistory[historyIndex], ...updates };
    scriptExecutionHistory.set(projectId, projectHistory);
  }
};

const getScriptExecutionHistory = (projectId: string): ScriptExecutionHistory[] => {
  return scriptExecutionHistory.get(projectId) || [];
};

const clearScriptExecutionHistory = (projectId: string) => {
  scriptExecutionHistory.delete(projectId);
};

// Helper function to get all child processes on Windows
const getChildProcessIds = async (parentPid: number): Promise<number[]> => {
  return new Promise((resolve) => {
    exec(`wmic process where "ParentProcessId=${parentPid}" get ProcessId /format:csv`, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const lines = stdout.split('\n');
      const pids: number[] = [];

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const pidStr = parts[1]?.trim();
          const pid = parseInt(pidStr, 10);
          if (!isNaN(pid) && pid > 0) {
            pids.push(pid);
          }
        }
      }

      resolve(pids);
    });
  });
};

// Helper function to kill process tree on Windows
const killProcessTree = async (pid: number): Promise<boolean> => {
  try {
    if (process.platform === 'win32') {
      console.log(`Killing process tree for PID ${pid} on Windows`);

      // Step 1: Get all child processes recursively
      const allPids = new Set<number>([pid]);
      const toCheck = [pid];

      while (toCheck.length > 0) {
        const currentPid = toCheck.pop()!;
        const childPids = await getChildProcessIds(currentPid);

        for (const childPid of childPids) {
          if (!allPids.has(childPid)) {
            allPids.add(childPid);
            toCheck.push(childPid);
          }
        }
      }

      console.log(`Found ${allPids.size} processes to terminate:`, Array.from(allPids));

      // Step 2: Kill all processes (children first, then parent)
      const pidsArray = Array.from(allPids);
      const killPromises = pidsArray.map(pidToKill => {
        return new Promise<void>((resolve) => {
          exec(`taskkill /F /PID ${pidToKill}`, (error) => {
            if (error) {
              // Only log if it's not a "process not found" error
              if (!error.message.includes('not found') && !error.message.includes('ERROR: The process')) {
                console.log(`Failed to kill PID ${pidToKill}:`, error.message);
              }
            } else {
              console.log(`Successfully killed PID ${pidToKill}`);
            }
            resolve();
          });
        });
      });

      // Step 3: Also try to kill the entire tree with taskkill /T as backup
      const treeKillPromise = new Promise<void>((resolve) => {
        exec(`taskkill /F /T /PID ${pid}`, (error) => {
          if (error && !error.message.includes('not found') && !error.message.includes('ERROR: The process')) {
            console.log(`Tree kill for PID ${pid} failed:`, error.message);
          }
          resolve();
        });
      });

      // Wait for all kill attempts to complete
      await Promise.all([...killPromises, treeKillPromise]);

      console.log(`Process tree termination completed for PID ${pid}`);
      return true;

    } else {
      // On Unix systems, kill the process group
      try {
        console.log(`Killing process group ${pid} on Unix`);
        process.kill(-pid, 'SIGTERM');

        // Wait a bit, then force kill
        setTimeout(() => {
          try {
            process.kill(-pid, 'SIGKILL');
            console.log(`Force killed process group ${pid}`);
          } catch (e) {
            // Process already dead, ignore
            console.log(`Process group ${pid} already terminated`);
          }
        }, 2000);

        return true;
      } catch (error) {
        if ((error as any).code === 'ESRCH') {
          console.log(`Process group ${pid} already terminated`);
          return true; // Process doesn't exist, consider success
        }
        console.log(`Error killing process group ${pid}:`, error);
        return false;
      }
    }
  } catch (error) {
    console.error(`Error in killProcessTree for PID ${pid}:`, error);
    return false;
  }
};

// Initialize store service
const initializeStore = () => {
  storeService = new StoreService();
  projectDetectionService = new ProjectDetectionService();
  trayService = new TrayService();
  backgroundTaskService = new BackgroundTaskService(storeService);
  terminalService = new TerminalService();
  terminalService = new TerminalService();

  // Initialize tray service with current notification settings
  const appSettings = storeService.getSettings();
  if ((appSettings as any).notifications) {
    trayService.updateNotificationSettings((appSettings as any).notifications);
  }

  // Set up terminal service event handlers
  terminalService.on('terminalData', (data) => {
    // Send terminal data to the renderer process
    console.log('Forwarding terminal data:', data); // Debug log
    if (mainWindow) {
      mainWindow.webContents.send('terminal:data', data.id, data.data);
    }
  });

  terminalService.on('terminalExit', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('terminal:exit', data);
    }
  });

  terminalService.on('terminalError', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('terminal:error', data);
    }
  });

  terminalService.on('terminalCreated', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('terminal:created', data);
    }
  });

  terminalService.on('terminalClosed', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('terminal:closed', data);
    }
  });
};

// IPC Handlers for project management
const setupIpcHandlers = () => {
  // Legacy example handler
  ipcMain.on('ipc-example', async (event, arg) => {
    const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    event.reply('ipc-example', msgTemplate('pong'));
  });

  // Dialog handlers
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    });

    return result.canceled ? null : result.filePaths[0];
  });

  // Project management handlers
  ipcMain.handle('project:add', async (event, name: string, projectPath: string) => {
    try {
      const project = storeService.addProject(name, projectPath);

      // Auto-detect and add scripts
      try {
        const detectedTypes = await projectDetectionService.detectProjectType(projectPath);
        const detectedScripts = await projectDetectionService.generateScripts(projectPath, detectedTypes);

        if (detectedScripts.length > 0) {
          storeService.addAutoDetectedScripts(project.id, detectedScripts);
        }
      } catch (detectionError) {
        console.warn('Error during script auto-detection:', detectionError);
        // Continue without auto-detection if it fails
      }

      // Update tray with new projects
      const projects = storeService.getProjects();
      trayService.updateProjects(projects);

      // Notify project added
      trayService.notifyProjectAdded(project.name);

      return project;
    } catch (error) {
      console.error('Error adding project:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  });

  ipcMain.handle('project:remove', async (event, id: string) => {
    try {
      // Get project name before removing for notification
      const project = storeService.getProject(id);
      const projectName = project?.name || 'Unknown Project';

      const success = storeService.removeProject(id);
      if (!success) {
        throw new Error('Project not found');
      }

      // Update tray with updated projects
      const projects = storeService.getProjects();
      trayService.updateProjects(projects);

      // Notify project removed
      trayService.notifyProjectRemoved(projectName);

      return true;
    } catch (error) {
      console.error('Error removing project:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  });

  ipcMain.handle('project:list', async () => {
    try {
      const projects = storeService.getProjects();
      return projects;
    } catch (error) {
      console.error('Error listing projects:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  });

  ipcMain.handle('project:select', async (event, id: string) => {
    try {
      storeService.setSelectedProjectId(id);
      const project = storeService.getProject(id);
      if (!project) {
        throw new Error('Project not found');
      }
      return project;
    } catch (error) {
      console.error('Error selecting project:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  });

  // Project detection handlers
  ipcMain.handle('project:detect-type', async (event, projectPath: string) => {
    try {
      const detectedTypes = await projectDetectionService.detectProjectType(projectPath);
      return { success: true, types: detectedTypes };
    } catch (error) {
      console.error('Error detecting project type:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('project:detect-scripts', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const detectedTypes = await projectDetectionService.detectProjectType(project.path);
      const detectedScripts = await projectDetectionService.generateScripts(project.path, detectedTypes);

      return { success: true, scripts: detectedScripts, types: detectedTypes };
    } catch (error) {
      console.error('Error detecting scripts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('project:refresh-auto-scripts', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const detectedTypes = await projectDetectionService.detectProjectType(project.path);
      const detectedScripts = await projectDetectionService.generateScripts(project.path, detectedTypes);

      const success = storeService.addAutoDetectedScripts(projectId, detectedScripts);

      return { success, scripts: detectedScripts, types: detectedTypes };
    } catch (error) {
      console.error('Error refreshing auto-detected scripts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('project:start-dev', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const devCommand = await projectDetectionService.findBestDevCommand(project.path);
      if (!devCommand) {
        return {
          success: false,
          error: 'No development command found for this project type',
          projectId
        };
      }

      const effectiveSettings = storeService.getEffectiveSettings(projectId);
      const projectPath = project.path;
      const processKey = `${projectId}:auto-dev`;

      console.log(`Attempting to start dev server for project: ${project.name}`);
      console.log(`Dev command: ${devCommand.command}`);
      console.log(`Project type: ${devCommand.projectType}`);
      console.log(`Working directory: ${projectPath}`);

      // Stop existing process if running
      if (runningProcesses.has(processKey)) {
        const existingProcess = runningProcesses.get(processKey);
        console.log(`Stopping existing dev server process for project: ${projectId}`);
        existingProcess?.kill('SIGTERM');
        runningProcesses.delete(processKey);
      }

      // Parse command and arguments more intelligently
      const commandParts = devCommand.command.trim().split(/\s+/);
      const command = commandParts[0];
      const args = commandParts.slice(1);

      console.log(`Parsed dev command: ${command}, args: ${JSON.stringify(args)}`);

      // Platform-specific dev server execution handling
      let childProcess: ChildProcess;

      if (process.platform === 'win32') {
        // On Windows, use more reliable approach with clean environment
        console.log('Starting dev server on Windows platform');

        try {
          childProcess = spawn(command, args, {
            cwd: projectPath,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false, // Keep attached for better process management
            windowsHide: false, // Don't hide windows for dev servers that might need UI
            env: {
              // Pass essential environment variables but avoid Node.js environment bleeding
              PATH: process.env.PATH,
              USERPROFILE: process.env.USERPROFILE,
              APPDATA: process.env.APPDATA,
              LOCALAPPDATA: process.env.LOCALAPPDATA,
              PROGRAMFILES: process.env.PROGRAMFILES,
              'PROGRAMFILES(X86)': process.env['PROGRAMFILES(X86)'],
              SYSTEMROOT: process.env.SYSTEMROOT,
              TEMP: process.env.TEMP,
              TMP: process.env.TMP,
              USERNAME: process.env.USERNAME,
              COMPUTERNAME: process.env.COMPUTERNAME,
            }
          });

          if (!childProcess.pid) {
            throw new Error('Failed to start dev server process: No PID obtained');
          }

          console.log(`Successfully started dev server process with PID: ${childProcess.pid}`);
        } catch (windowsSpawnError) {
          console.error('Error spawning dev server on Windows:', windowsSpawnError);
          throw new Error(`Failed to start dev server on Windows: ${windowsSpawnError instanceof Error ? windowsSpawnError.message : 'Unknown error'}`);
        }
      } else {
        // For non-Windows platforms
        console.log('Starting dev server on non-Windows platform');

        try {
          childProcess = spawn(command, args, {
            cwd: projectPath,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false,
            env: {
              ...process.env, // On non-Windows, keep more of the environment
            }
          });

          if (!childProcess.pid) {
            throw new Error('Failed to start dev server process: No PID obtained');
          }

          console.log(`Successfully started dev server process with PID: ${childProcess.pid}`);
        } catch (nonWindowsSpawnError) {
          console.error('Error spawning dev server on non-Windows:', nonWindowsSpawnError);
          throw new Error(`Failed to start dev server: ${nonWindowsSpawnError instanceof Error ? nonWindowsSpawnError.message : 'Unknown error'}`);
        }
      }

      // Store process reference
      runningProcesses.set(processKey, childProcess);

      // Set up enhanced output streaming with better logging
      childProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`Dev server stdout:`, output.trim());
        if (mainWindow) {
          mainWindow.webContents.send('script:output', {
            projectId,
            scriptId: 'auto-dev',
            type: 'stdout',
            data: output
          });
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        console.log(`Dev server stderr:`, output.trim());
        if (mainWindow) {
          mainWindow.webContents.send('script:output', {
            projectId,
            scriptId: 'auto-dev',
            type: 'stderr',
            data: output
          });
        }
      });

      childProcess.on('close', (code, signal) => {
        console.log(`Dev server closed with code: ${code}, signal: ${signal}`);
        runningProcesses.delete(processKey);
        if (mainWindow) {
          mainWindow.webContents.send('script:status', {
            projectId,
            scriptId: 'auto-dev',
            status: 'stopped',
            exitCode: code,
            signal: signal
          });
        }
      });

      childProcess.on('error', (error) => {
        console.error(`Dev server error:`, error);
        runningProcesses.delete(processKey);
        if (mainWindow) {
          mainWindow.webContents.send('script:status', {
            projectId,
            scriptId: 'auto-dev',
            status: 'error',
            error: error.message
          });
        }
      });

      // Handle process exit event for additional cleanup
      childProcess.on('exit', (code, signal) => {
        console.log(`Dev server exited with code: ${code}, signal: ${signal}`);
        if (runningProcesses.has(processKey)) {
          runningProcesses.delete(processKey);
        }
      });

      // Send started status with enhanced information
      if (mainWindow) {
        mainWindow.webContents.send('script:status', {
          projectId,
          scriptId: 'auto-dev',
          status: 'running',
          pid: childProcess.pid,
          command: devCommand.command,
          startTime: new Date().toISOString()
        });
      }

      return {
        success: true,
        command: devCommand.command,
        projectType: devCommand.projectType,
        pid: childProcess.pid,
        message: `Development server started successfully for project: ${project.name}`
      };
    } catch (error) {
      console.error('Error starting dev server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId
      };
    }
  });

  // Script management handlers
  ipcMain.handle('project:add-script', async (event, projectId: string, script: { name: string; command: string }) => {
    try {
      const newScript = storeService.addScript(projectId, script);
      return { success: true, script: newScript };
    } catch (error) {
      console.error('Error adding script:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('project:remove-script', async (event, projectId: string, scriptId: string) => {
    try {
      const success = storeService.removeScript(projectId, scriptId);
      return { success };
    } catch (error) {
      console.error('Error removing script:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('project:update-script', async (event, projectId: string, script: { id: string; name: string; command: string }) => {
    try {
      const success = storeService.updateScript(projectId, script);
      return { success };
    } catch (error) {
      console.error('Error updating script:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Script execution handlers
  ipcMain.handle('script:execute', async (event, projectId: string, scriptId: string) => {
    try {
      const project = storeService.getProject(projectId);
      const script = storeService.getScript(projectId, scriptId);

      if (!project || !script) {
        throw new Error('Project or script not found');
      }

      const effectiveSettings = storeService.getEffectiveSettings(projectId);
      const projectPath = project.path;
      const processKey = `${projectId}:${scriptId}`;

      console.log(`Attempting to execute script "${script.name}" (${scriptId}) for project: ${project.name}`);
      console.log(`Script command: ${script.command}`);
      console.log(`Working directory: ${projectPath}`);

      // Stop existing process if running
      if (runningProcesses.has(processKey)) {
        const existingProcess = runningProcesses.get(processKey);
        console.log(`Stopping existing process for script: ${scriptId}`);
        const existingPid = existingProcess?.pid;
        if (existingPid) {
          await killProcessTree(existingPid);
        }
        runningProcesses.delete(processKey);
      }

      // Parse command and arguments more intelligently
      const commandParts = script.command.trim().split(/\s+/);
      const command = commandParts[0];
      const args = commandParts.slice(1);

      console.log(`Parsed command: ${command}, args: ${JSON.stringify(args)}`);

      // Platform-specific script execution handling
      let childProcess: ChildProcess;

      if (process.platform === 'win32') {
        // On Windows, use more reliable approach with clean environment
        console.log('Executing script on Windows platform');

        try {
          childProcess = spawn(command, args, {
            cwd: projectPath,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false, // Keep attached for better process management
            windowsHide: false, // Don't hide windows for scripts that might need UI
            // Create a new process group for easier termination
            windowsVerbatimArguments: false,
            env: {
              // Pass essential environment variables but avoid Node.js environment bleeding
              PATH: process.env.PATH,
              USERPROFILE: process.env.USERPROFILE,
              APPDATA: process.env.APPDATA,
              LOCALAPPDATA: process.env.LOCALAPPDATA,
              PROGRAMFILES: process.env.PROGRAMFILES,
              'PROGRAMFILES(X86)': process.env['PROGRAMFILES(X86)'],
              SYSTEMROOT: process.env.SYSTEMROOT,
              TEMP: process.env.TEMP,
              TMP: process.env.TMP,
              USERNAME: process.env.USERNAME,
              COMPUTERNAME: process.env.COMPUTERNAME,
              // Add Node.js specific environment to help with process management
              FORCE_COLOR: '0', // Disable colors to avoid terminal issues
              CI: 'true', // Some tools behave better in CI mode
            }
          });

          if (!childProcess.pid) {
            throw new Error('Failed to start script process: No PID obtained');
          }

          console.log(`Successfully started script process with PID: ${childProcess.pid}`);
        } catch (windowsSpawnError) {
          console.error('Error spawning script on Windows:', windowsSpawnError);
          throw new Error(`Failed to execute script on Windows: ${windowsSpawnError instanceof Error ? windowsSpawnError.message : 'Unknown error'}`);
        }
      } else {
        // For non-Windows platforms, use process groups for better termination
        console.log('Executing script on non-Windows platform');

        try {
          childProcess = spawn(command, args, {
            cwd: projectPath,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: true, // Create new process group for easier termination
            env: {
              ...process.env, // On non-Windows, keep more of the environment
            }
          });

          if (!childProcess.pid) {
            throw new Error('Failed to start script process: No PID obtained');
          }

          // Make the child process the leader of a new process group
          childProcess.unref();

          console.log(`Successfully started script process with PID: ${childProcess.pid}`);
        } catch (nonWindowsSpawnError) {
          console.error('Error spawning script on non-Windows:', nonWindowsSpawnError);
          throw new Error(`Failed to execute script: ${nonWindowsSpawnError instanceof Error ? nonWindowsSpawnError.message : 'Unknown error'}`);
        }
      }

      // Store process reference
      runningProcesses.set(processKey, childProcess);

      // Set up enhanced output streaming with better logging
      childProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`Script ${scriptId} stdout:`, output.trim());

        // Update history with accumulated output
        const projectHistory = getScriptExecutionHistory(projectId);
        const latestExecution = projectHistory.find(h => h.scriptId === scriptId && h.status === 'running');
        if (latestExecution) {
          updateScriptExecutionHistory(projectId, latestExecution.id, {
            output: latestExecution.output + output
          });
        }

        if (mainWindow) {
          mainWindow.webContents.send('script:output', {
            projectId,
            scriptId,
            type: 'stdout',
            data: output
          });
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        console.log(`Script ${scriptId} stderr:`, output.trim());

        // Update history with accumulated output (including stderr)
        const projectHistory = getScriptExecutionHistory(projectId);
        const latestExecution = projectHistory.find(h => h.scriptId === scriptId && h.status === 'running');
        if (latestExecution) {
          updateScriptExecutionHistory(projectId, latestExecution.id, {
            output: latestExecution.output + output
          });
        }

        if (mainWindow) {
          mainWindow.webContents.send('script:output', {
            projectId,
            scriptId,
            type: 'stderr',
            data: output
          });
        }
      });

      childProcess.on('close', (code, signal) => {
        console.log(`Script ${scriptId} closed with code: ${code}, signal: ${signal}`);
        runningProcesses.delete(processKey);

        // Update execution history on completion
        const projectHistory = getScriptExecutionHistory(projectId);
        const latestExecution = projectHistory.find(h => h.scriptId === scriptId && h.status === 'running');
        if (latestExecution) {
          const endTime = new Date().toISOString();
          const duration = Date.now() - new Date(latestExecution.startTime).getTime();
          updateScriptExecutionHistory(projectId, latestExecution.id, {
            status: code === 0 ? 'completed' : 'failed',
            endTime,
            duration,
            exitCode: code || undefined
          });
        }

        if (mainWindow) {
          mainWindow.webContents.send('script:status', {
            projectId,
            scriptId,
            status: 'stopped',
            exitCode: code,
            signal: signal
          });
        }
      });

      childProcess.on('error', (error) => {
        console.error(`Script ${scriptId} error:`, error);
        runningProcesses.delete(processKey);

        // Update execution history on error
        const projectHistory = getScriptExecutionHistory(projectId);
        const latestExecution = projectHistory.find(h => h.scriptId === scriptId && h.status === 'running');
        if (latestExecution) {
          const endTime = new Date().toISOString();
          const duration = Date.now() - new Date(latestExecution.startTime).getTime();
          updateScriptExecutionHistory(projectId, latestExecution.id, {
            status: 'failed',
            endTime,
            duration,
            error: error.message
          });
        }

        if (mainWindow) {
          mainWindow.webContents.send('script:status', {
            projectId,
            scriptId,
            status: 'error',
            error: error.message
          });
        }
      });

      // Handle process exit event for additional cleanup
      childProcess.on('exit', (code, signal) => {
        console.log(`Script ${scriptId} exited with code: ${code}, signal: ${signal}`);
        if (runningProcesses.has(processKey)) {
          runningProcesses.delete(processKey);

          // Update tray - remove running script
          trayService.removeRunningScript(script.name);

          // Notify based on exit code
          if (code === 0) {
            // Script completed successfully
            trayService.notifyScriptCompleted(project.name, script.name);
          } else {
            // Script failed
            const errorMessage = signal ? `killed by ${signal}` : `exit code ${code}`;
            trayService.notifyScriptError(project.name, script.name, errorMessage);
          }
        }
      });

      // Send started status with enhanced information
      if (mainWindow) {
        mainWindow.webContents.send('script:status', {
          projectId,
          scriptId,
          status: 'running',
          pid: childProcess.pid,
          command: script.command,
          startTime: new Date().toISOString()
        });
      }

      // Add execution to history
      const historyId = `${projectId}-${scriptId}-${Date.now()}`;
      addScriptExecutionHistory({
        id: historyId,
        projectId,
        scriptId,
        scriptName: script.name,
        command: script.command,
        startTime: new Date().toISOString(),
        status: 'running',
        output: '', // Will be accumulated from stdout/stderr
      });

      // Update tray with running script
      trayService.addRunningScript(script.name, script.command, childProcess.pid);

      // Notify script started
      trayService.notifyScriptStarted(project.name, script.name);

      return {
        success: true,
        pid: childProcess.pid,
        command: script.command,
        message: `Script "${script.name}" started successfully`
      };
    } catch (error) {
      console.error('Error executing script:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        scriptId,
        projectId
      };
    }
  });

  ipcMain.handle('script:stop', async (event, projectId: string, scriptId: string) => {
    try {
      const processKey = `${projectId}:${scriptId}`;
      const childProcess = runningProcesses.get(processKey);

      console.log(`Attempting to stop script: ${scriptId} for project: ${projectId}`);

      if (!childProcess) {
        console.log(`No running process found for script: ${scriptId}`);
        return {
          success: false,
          error: 'Process not found or already stopped',
          scriptId,
          projectId
        };
      }

      const pid = childProcess.pid;
      if (!pid) {
        console.log(`No PID found for script: ${scriptId}`);
        return {
          success: false,
          error: 'Process PID not available',
          scriptId,
          projectId
        };
      }

      console.log(`Terminating process tree with PID: ${pid} for script: ${scriptId}`);

      // Immediately remove from running processes to prevent race conditions
      runningProcesses.delete(processKey);

      // Get script name for tray update
      const script = storeService.getScript(projectId, scriptId);
      if (script) {
        trayService.removeRunningScript(script.name);
      }

      // Update execution history on stop - find the latest running execution for this script
      const projectHistory = getScriptExecutionHistory(projectId);
      const latestExecution = projectHistory.find(h => h.scriptId === scriptId && h.status === 'running');
      if (latestExecution) {
        updateScriptExecutionHistory(projectId, latestExecution.id, {
          status: 'cancelled',
          endTime: new Date().toISOString(),
          duration: Date.now() - new Date(latestExecution.startTime).getTime(),
        });
      }

      // Send stopped status immediately
      if (mainWindow) {
        mainWindow.webContents.send('script:status', {
          projectId,
          scriptId,
          status: 'stopped',
          message: 'Script termination initiated'
        });
      }

      // Try graceful shutdown first
      let gracefulShutdown = false;

      // Set up event listener for graceful shutdown detection
      const onProcessExit = () => {
        gracefulShutdown = true;
        console.log(`Script process ${scriptId} terminated gracefully`);
      };

      // Listen for process exit events
      childProcess.once('exit', onProcessExit);
      childProcess.once('close', onProcessExit);

      try {
        if (process.platform === 'win32') {
          // On Windows, try CTRL+C first for graceful shutdown
          childProcess.kill('SIGINT');
        } else {
          childProcess.kill('SIGTERM');
        }

        // Wait for graceful shutdown with timeout
        const gracefulWaitPromise = new Promise<void>(resolve => {
          const waitTimeout = setTimeout(() => {
            if (!gracefulShutdown) {
              console.log(`Graceful shutdown timeout for script: ${scriptId}`);
            }
            resolve();
          }, 5000); // Increased to 5 seconds for Node.js processes

          // If process exits gracefully, resolve immediately
          const exitHandler = () => {
            clearTimeout(waitTimeout);
            resolve();
          };
          childProcess.once('exit', exitHandler);
          childProcess.once('close', exitHandler);
        });

        await gracefulWaitPromise;

      } catch (error) {
        console.log(`Error during graceful shutdown for ${scriptId}:`, error);
      }

      // Verify if the process is actually gone and check for child processes
      const processStillExists = await new Promise<boolean>((resolve) => {
        if (process.platform === 'win32') {
          exec(`tasklist /FI "PID eq ${pid}"`, (error, stdout) => {
            if (error || !stdout.includes(`${pid}`)) {
              resolve(false); // Process is gone
            } else {
              resolve(true); // Process still exists
            }
          });
        } else {
          try {
            process.kill(pid, 0); // Test if process exists
            resolve(true); // Process exists
          } catch (e) {
            resolve(false); // Process is gone
          }
        }
      });

      // Always check for child processes, even if parent terminated gracefully
      // This is crucial for tools like pnpm/npm that spawn child processes
      console.log(`Checking for child processes of PID ${pid}...`);
      const childPids = await getChildProcessIds(pid);

      // Get all descendant processes recursively
      const allDescendantPids = new Set<number>(childPids);
      const toCheck = [...childPids];

      while (toCheck.length > 0) {
        const currentPid = toCheck.pop()!;
        const grandChildPids = await getChildProcessIds(currentPid);

        for (const grandChildPid of grandChildPids) {
          if (!allDescendantPids.has(grandChildPid)) {
            allDescendantPids.add(grandChildPid);
            toCheck.push(grandChildPid);
          }
        }
      }

      const hasLivingDescendants = allDescendantPids.size > 0;

      if (hasLivingDescendants) {
        console.log(`Found ${allDescendantPids.size} descendant processes that need to be killed:`, Array.from(allDescendantPids));
      }

      // Force kill if:
      // 1. Graceful shutdown failed OR
      // 2. Parent process still exists OR
      // 3. There are living child/descendant processes
      if (!gracefulShutdown || processStillExists || hasLivingDescendants) {
        console.log(`Force killing process tree for script: ${scriptId} (graceful: ${gracefulShutdown}, parent exists: ${processStillExists}, descendants: ${hasLivingDescendants})`);
        try {
          await killProcessTree(pid);

          // Also kill any remaining descendants directly
          if (hasLivingDescendants) {
            console.log(`Killing remaining descendant processes...`);
            for (const descendantPid of allDescendantPids) {
              exec(`taskkill /F /PID ${descendantPid}`, (error) => {
                if (error && !error.message.includes('not found') && !error.message.includes('ERROR: The process')) {
                  console.log(`Failed to kill descendant PID ${descendantPid}:`, error.message);
                }
              });
            }
          }
        } catch (killError) {
          console.log(`Process tree kill failed:`, killError);
        }
      } else {
        console.log(`Script ${scriptId} terminated gracefully with no remaining processes`);
      }

      return {
        success: true,
        message: `Script ${scriptId} has been terminated`,
        scriptId,
        projectId
      };
    } catch (error) {
      console.error('Error stopping script:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        scriptId,
        projectId
      };
    }
  });

  ipcMain.handle('script:is-running', async (event, projectId: string, scriptId: string) => {
    try {
      const processKey = `${projectId}:${scriptId}`;
      const isRunning = runningProcesses.has(processKey);
      const process = runningProcesses.get(processKey);

      console.log(`Checking if script ${scriptId} is running: ${isRunning}`);

      return {
        success: true,
        isRunning,
        pid: process?.pid || null,
        scriptId,
        projectId
      };
    } catch (error) {
      console.error('Error checking script status:', error);
      return {
        success: false,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        scriptId,
        projectId
      };
    }
  });

  // Script execution history handlers
  ipcMain.handle('script:get-execution-history', async (event, projectId: string) => {
    try {
      const history = getScriptExecutionHistory(projectId);
      return {
        success: true,
        history
      };
    } catch (error) {
      console.error('Error getting script execution history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        history: []
      };
    }
  });

  ipcMain.handle('script:clear-execution-history', async (event, projectId: string) => {
    try {
      clearScriptExecutionHistory(projectId);
      return {
        success: true,
        message: 'Script execution history cleared'
      };
    } catch (error) {
      console.error('Error clearing script execution history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Environment variable handlers
  ipcMain.handle('env:load', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const envPath = path.join(project.path, '.env');

      if (!existsSync(envPath)) {
        return { success: true, exists: false, variables: {} };
      }

      const envContent = await fs.readFile(envPath, 'utf-8');
      const parsed = dotenv.parse(envContent);

      return {
        success: true,
        exists: true,
        variables: parsed,
        originalContent: envContent
      };
    } catch (error) {
      console.error('Error loading .env file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('env:save', async (event, projectId: string, variables: Record<string, string>) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const envPath = path.join(project.path, '.env');

      // Create backup if file exists
      if (existsSync(envPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(project.path, `.env.bak-${timestamp}`);
        await fs.copyFile(envPath, backupPath);
      }

      // Construct .env content from variables
      const envContent = Object.entries(variables)
        .map(([key, value]) => {
          // Escape quotes and handle multiline values
          const escapedValue = value.includes('\n') || value.includes('"') || value.includes("'")
            ? `"${value.replace(/"/g, '\\"')}"`
            : value;
          return `${key}=${escapedValue}`;
        })
        .join('\n');

      // Add trailing newline
      const finalContent = envContent ? `${envContent}\n` : '';

      await fs.writeFile(envPath, finalContent, 'utf-8');

      return { success: true };
    } catch (error) {
      console.error('Error saving .env file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('env:backup', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const envPath = path.join(project.path, '.env');

      if (!existsSync(envPath)) {
        return { success: false, error: '.env file does not exist' };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(project.path, `.env.bak-${timestamp}`);

      await fs.copyFile(envPath, backupPath);

      return { success: true, backupPath };
    } catch (error) {
      console.error('Error creating .env backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Quick action handlers
  ipcMain.handle('action:open-ide', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const effectiveSettings = storeService.getEffectiveSettings(projectId);
      let ideCommand = effectiveSettings.ideCommand || 'code'; // Default to VS Code
      const projectPath = project.path;

      console.log(`Attempting to open project at ${projectPath} with IDE command: ${ideCommand}`);

      // Helper function to find IDE executable paths on Windows
      const findIDEPath = (ideCommand: string): string => {
        if (process.platform !== 'win32') {
          return ideCommand; // On non-Windows, use the command as-is
        }

        const commonPaths: Record<string, string[]> = {
          'code': [
            'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
            'C:\\Program Files\\Microsoft VS Code\\Code.exe',
            'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe'
          ],
          'cursor': [
            'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\cursor\\Cursor.exe',
            'C:\\Program Files\\Cursor\\Cursor.exe',
            'C:\\Program Files (x86)\\Cursor\\Cursor.exe'
          ],
          'subl': [
            'C:\\Program Files\\Sublime Text 3\\sublime_text.exe',
            'C:\\Program Files\\Sublime Text\\sublime_text.exe',
            'C:\\Program Files (x86)\\Sublime Text 3\\sublime_text.exe'
          ]
        };

        const paths = commonPaths[ideCommand.toLowerCase()];
        if (!paths) return ideCommand;

        for (const path of paths) {
          const expandedPath = path.replace('%USERNAME%', os.userInfo().username);
          if (existsSync(expandedPath)) {
            console.log(`Found IDE at: ${expandedPath}`);
            return expandedPath;
          }
        }

        return ideCommand; // Fallback to original command
      };

      // On Windows platform, try to open project using a batch file
      if (process.platform === 'win32') {
        const resolvedIDECommand = findIDEPath(ideCommand);

        try {
          console.log(`Attempting to open IDE: ${resolvedIDECommand} with path: ${projectPath}`);

          // Special handling for different IDE commands
          let spawnArgs: string[] = [];

          if (ideCommand.toLowerCase() === 'code') {
            // For VS Code, we'll use a simple approach without start command
            // Just running 'code' with the path argument directly
            spawnArgs = ['/c', 'code', projectPath];
          } else {
            // For other IDEs, use normal approach
            spawnArgs = ['/c', ideCommand, projectPath];
          }

          console.log(`Executing command: cmd.exe ${spawnArgs.join(' ')}`);

          const ideProcess = spawn('cmd.exe', spawnArgs, {
            stdio: 'ignore',  // Don't inherit stdio to avoid Node.js environment bleeding
            detached: true,   // Detach the process completely
            windowsHide: false, // Hide the cmd window
            env: {
              // Only pass essential environment variables, not the full Node.js environment
              PATH: process.env.PATH,
              USERPROFILE: process.env.USERPROFILE,
              APPDATA: process.env.APPDATA,
              LOCALAPPDATA: process.env.LOCALAPPDATA,
              // Explicitly exclude Node.js related environment variables
              // that might be causing the ts-node/register issue
            }
          });

          if (ideProcess.pid) {
            ideProcess.unref();
            console.log(`Successfully launched IDE process with PID: ${ideProcess.pid}`);
            return { success: true, message: "IDE launched using cmd start with clean environment." };
          }
          throw new Error('Failed to start IDE process: No PID obtained.');
        } catch (directSpawnError) {
          console.error('Error directly spawning IDE:', directSpawnError);

          // Fallback to shell.openPath if direct spawn fails
          console.log('Attempting to open with shell.openPath as a fallback.');
          await shell.openPath(projectPath);
          return {
            success: true,
            message: 'Opened project folder with default application (IDE command failed)'
          };
        }
      } else {
        // For non-Windows platforms, use shell.openPath or a direct command if appropriate
        // This part of the logic can be refined based on how other OSes are handled
        console.log(`Attempting to open project on non-Windows platform with: ${ideCommand} ${projectPath}`);
        try {
          // Attempt to spawn directly for non-windows too, assuming command is in PATH
          const ideProcess = spawn(ideCommand, [projectPath], {
            detached: true,
            stdio: 'ignore',
            shell: true // Use shell for consistency and PATH resolution
          });
          if (ideProcess.pid) {
            ideProcess.unref();
            console.log(`Successfully launched IDE process with PID: ${ideProcess.pid} on non-Windows`);
            return { success: true };
          }
          throw new Error('Failed to start IDE process on non-Windows: No PID obtained.');
        } catch (nonWindowsError) {
          console.error('Error spawning IDE on non-Windows:', nonWindowsError);
          console.log('Falling back to shell.openPath on non-Windows.');
          await shell.openPath(projectPath); // Fallback for non-windows
          return {
            success: true,
            message: 'Opened project folder with default application (IDE command failed)'
          };
        }
      }
    } catch (error) {
      console.error('Error opening IDE:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('action:open-folder', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const projectPath = project.path;

      // Open the project folder in the default file manager
      await shell.openPath(projectPath);

      return { success: true };
    } catch (error) {
      console.error('Error opening folder:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('action:open-terminal', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const effectiveSettings = storeService.getEffectiveSettings(projectId);
      const projectPath = project.path;
      const platform = os.platform();

      console.log(`Opening terminal for project: ${project.name} at path: ${projectPath}`);

      return new Promise((resolve) => {
        try {
          if (platform === 'win32') {
            // On Windows, use a more reliable approach
            const terminalCommand = effectiveSettings.terminalCommand || 'powershell.exe';
            const command = `start "" "${terminalCommand}" -NoExit -Command "cd '${projectPath.replace(/\\/g, '\\')}'"`;
            console.log(`Executing command: ${command}`);

            const result = spawn('cmd.exe', ['/c', command], {
              detached: true,
              stdio: 'ignore',
              shell: true,
              windowsHide: true
            });

            result.on('error', (error) => {
              console.error('Failed to open terminal:', error);
              resolve({ success: false, error: error.message });
            });

            // Give it a moment to start
            setTimeout(() => {
              try {
                if (result.pid) {
                  process.kill(result.pid, 0);
                  console.log('Successfully opened terminal');
                  resolve({ success: true });
                } else {
                  throw new Error('No process ID available');
                }
              } catch (e) {
                console.error('Terminal process failed to start');
                resolve({
                  success: false,
                  error: 'Failed to start terminal. Make sure the terminal application is installed.'
                });
              }
            }, 1000);

          } else {
            // For non-Windows platforms (macOS/Linux)
            let command: string;
            if (effectiveSettings.terminalCommand) {
              command = `cd "${projectPath}" && ${effectiveSettings.terminalCommand}`;
            } else {
              // Default terminal commands for different platforms
              const terminals = {
                darwin: `open -a Terminal "${projectPath}"`,
                linux: `gnome-terminal --working-directory="${projectPath}"`,
                default: `cd "${projectPath}" && $SHELL`
              };
              command = terminals[platform as keyof typeof terminals] || terminals.default;
            }

            console.log(`Executing command: ${command}`);

            const result = spawn(command, {
              shell: true,
              detached: true,
              stdio: 'ignore'
            });

            result.on('error', (error) => {
              console.error('Failed to open terminal:', error);
              resolve({ success: false, error: error.message });
            });

            result.unref();
            console.log('Successfully opened terminal');
            resolve({ success: true });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error opening terminal:', errorMessage);
          resolve({
            success: false,
            error: `Failed to open terminal: ${errorMessage}`
          });
        }
      });

    } catch (error) {
      console.error('Error opening terminal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Settings handlers
  ipcMain.handle('settings:get', async () => {
    try {
      const settings = storeService.getSettings();
      return { success: true, settings };
    } catch (error) {
      console.error('Error getting settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('settings:update', async (event, settings: Partial<AppSettings>) => {
    try {
      storeService.updateSettings(settings);

      // Update tray notification settings if they changed
      if ((settings as any).notifications) {
        trayService.updateNotificationSettings((settings as any).notifications);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Project settings handlers
  ipcMain.handle('project:get-settings', async (event, projectId: string) => {
    try {
      const projectSettings = storeService.getProjectSettings(projectId);
      const effectiveSettings = storeService.getEffectiveSettings(projectId);
      return {
        success: true,
        projectSettings,
        effectiveSettings
      };
    } catch (error) {
      console.error('Error getting project settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('project:update-settings', async (event, projectId: string, settings: Partial<{ ideCommand: string; terminalCommand: string }>) => {
    try {
      const success = storeService.updateProjectSettings(projectId, settings);
      if (!success) {
        throw new Error('Project not found');
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating project settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Environment configuration handlers
  ipcMain.handle('env-config:load', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Get environment configuration metadata from project settings
      const envMetadata = project.settings?.environmentConfig || {
        activeConfigId: undefined,
        configurations: []
      };

      // Scan for environment files in the project directory
      const envFiles = ['.env', '.env.dev', '.env.development', '.env.staging', '.env.production', '.env.test', '.env.local'];
      const foundConfigurations: EnvironmentConfiguration[] = [];

      for (const filename of envFiles) {
        const envPath = path.join(project.path, filename);
        if (existsSync(envPath)) {
          const envContent = await fs.readFile(envPath, 'utf-8');
          const parsed = dotenv.parse(envContent);

          // Check if this configuration already exists in metadata
          let existingConfig = envMetadata.configurations.find((c: EnvironmentConfiguration) => c.filename === filename);
          if (!existingConfig) {
            // Create new configuration entry
            existingConfig = {
              id: `${filename}-${Date.now()}`,
              name: getDisplayNameForEnvFile(filename),
              filename: filename,
              displayName: getDisplayNameForEnvFile(filename),
              variables: parsed,
              exists: true,
              lastModified: new Date().toISOString()
            };
          } else {
            // Update existing configuration
            existingConfig.variables = parsed;
            existingConfig.exists = true;
            existingConfig.lastModified = new Date().toISOString();
          }

          foundConfigurations.push(existingConfig);
        }
      }

      // Check for custom environment files referenced in metadata but not in standard list
      for (const config of envMetadata.configurations) {
        if (!envFiles.includes(config.filename)) {
          const envPath = path.join(project.path, config.filename);
          if (existsSync(envPath)) {
            const envContent = await fs.readFile(envPath, 'utf-8');
            const parsed = dotenv.parse(envContent);

            config.variables = parsed;
            config.exists = true;
            config.lastModified = new Date().toISOString();
            foundConfigurations.push(config);
          } else {
            // Mark as not existing but keep in list
            config.exists = false;
            foundConfigurations.push(config);
          }
        }
      }

      // Update metadata with found configurations
      envMetadata.configurations = foundConfigurations;

      // Set default active configuration if none is set
      if (!envMetadata.activeConfigId && foundConfigurations.length > 0) {
        // Prefer .env if it exists, otherwise take the first one
        const defaultConfig = foundConfigurations.find(c => c.filename === '.env') || foundConfigurations[0];
        envMetadata.activeConfigId = defaultConfig.id;
      }

      // Mark active configuration
      foundConfigurations.forEach(config => {
        config.isActive = config.id === envMetadata.activeConfigId;
      });

      return {
        success: true,
        metadata: envMetadata
      };
    } catch (error) {
      console.error('Error loading environment configurations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('env-config:switch', async (event, projectId: string, configId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Update project settings with new active configuration
      const updatedProject = {
        ...project,
        settings: {
          ...project.settings,
          environmentConfig: {
            ...project.settings?.environmentConfig,
            activeConfigId: configId
          }
        }
      };

      storeService.updateProject(updatedProject);

      return { success: true };
    } catch (error) {
      console.error('Error switching environment configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('env-config:create', async (event, projectId: string, name: string, filename: string, template?: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const envPath = path.join(project.path, filename);

      // Check if file already exists
      if (existsSync(envPath)) {
        return {
          success: false,
          error: 'Environment file already exists'
        };
      }

      // Get template variables
      const templateVariables = getTemplateVariables(template);

      // Create new configuration
      const newConfig = {
        id: `${filename}-${Date.now()}`,
        name: name,
        filename: filename,
        displayName: name,
        template: template,
        variables: templateVariables,
        exists: true,
        lastModified: new Date().toISOString()
      };

      // Create the environment file with template content
      const envContent = Object.entries(templateVariables)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      await fs.writeFile(envPath, envContent ? `${envContent}\n` : '', 'utf-8');

      // Update project settings
      const envMetadata = project.settings?.environmentConfig || {
        activeConfigId: undefined,
        configurations: []
      };

      envMetadata.configurations.push(newConfig);

      const updatedProject = {
        ...project,
        settings: {
          ...project.settings,
          environmentConfig: envMetadata
        }
      };

      storeService.updateProject(updatedProject);

      return {
        success: true,
        configuration: newConfig
      };
    } catch (error) {
      console.error('Error creating environment configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('env-config:save', async (event, projectId: string, configId: string, variables: Record<string, string>) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const envMetadata = project.settings?.environmentConfig;
      if (!envMetadata) {
        throw new Error('No environment configuration found');
      }

      const config = envMetadata.configurations.find((c: EnvironmentConfiguration) => c.id === configId);
      if (!config) {
        throw new Error('Configuration not found');
      }

      const envPath = path.join(project.path, config.filename);

      // Create backup if file exists
      if (existsSync(envPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(project.path, `${config.filename}.bak-${timestamp}`);
        await fs.copyFile(envPath, backupPath);
      }

      // Construct .env content from variables
      const envContent = Object.entries(variables)
        .map(([key, value]) => {
          const escapedValue = value.includes('\n') || value.includes('"') || value.includes("'")
            ? `"${value.replace(/"/g, '\\"')}"`
            : value;
          return `${key}=${escapedValue}`;
        })
        .join('\n');

      await fs.writeFile(envPath, envContent ? `${envContent}\n` : '', 'utf-8');

      // Update configuration metadata
      config.variables = variables;
      config.lastModified = new Date().toISOString();

      const updatedProject = {
        ...project,
        settings: {
          ...project.settings,
          environmentConfig: envMetadata
        }
      };

      storeService.updateProject(updatedProject);

      return { success: true };
    } catch (error) {
      console.error('Error saving environment configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('env-config:delete', async (event, projectId: string, configId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const envMetadata = project.settings?.environmentConfig;
      if (!envMetadata) {
        throw new Error('No environment configuration found');
      }

      const config = envMetadata.configurations.find((c: EnvironmentConfiguration) => c.id === configId);
      if (!config) {
        throw new Error('Configuration not found');
      }

      const envPath = path.join(project.path, config.filename);

      // Delete the file if it exists
      if (existsSync(envPath)) {
        await fs.unlink(envPath);
      }

      // Remove from configurations list
      envMetadata.configurations = envMetadata.configurations.filter(c => c.id !== configId);

      // If this was the active configuration, switch to another one
      if (envMetadata.activeConfigId === configId) {
        envMetadata.activeConfigId = envMetadata.configurations.length > 0
          ? envMetadata.configurations[0].id
          : undefined;
      }

      const updatedProject = {
        ...project,
        settings: {
          ...project.settings,
          environmentConfig: envMetadata
        }
      };

      storeService.updateProject(updatedProject);

      return { success: true };
    } catch (error) {
      console.error('Error deleting environment configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Environment configuration handlers END

  // Helper functions for environment configuration
  function getDisplayNameForEnvFile(filename: string): string {
    const nameMap: Record<string, string> = {
      '.env': 'Default',
      '.env.dev': 'Development',
      '.env.development': 'Development',
      '.env.staging': 'Staging',
      '.env.production': 'Production',
      '.env.test': 'Testing',
      '.env.local': 'Local'
    };
    return nameMap[filename] || filename.replace('.env.', '').replace('.env', 'Custom');
  }

  function getTemplateVariables(template?: string): Record<string, string> {
    const templates: Record<string, Record<string, string>> = {
      'development': {
        'NODE_ENV': 'development',
        'API_URL': 'http://localhost:3001',
        'DATABASE_URL': 'postgres://localhost:5432/myapp_dev',
        'DEBUG': 'true',
        'LOG_LEVEL': 'debug'
      },
      'staging': {
        'NODE_ENV': 'staging',
        'API_URL': 'https://api-staging.example.com',
        'DATABASE_URL': 'postgres://staging-db:5432/myapp_staging',
        'DEBUG': 'false',
        'LOG_LEVEL': 'info'
      },
      'production': {
        'NODE_ENV': 'production',
        'API_URL': 'https://api.example.com',
        'DATABASE_URL': '',
        'DEBUG': 'false',
        'LOG_LEVEL': 'error',
        'SECURE': 'true'
      },
      'testing': {
        'NODE_ENV': 'test',
        'API_URL': 'http://localhost:3001',
        'DATABASE_URL': 'postgres://localhost:5432/myapp_test',
        'DEBUG': 'true',
        'LOG_LEVEL': 'debug',
        'TEST_TIMEOUT': '30000'
      }
    };

    return templates[template || ''] || {};
  }

  // Environment variable handlers

  // Git handlers
  ipcMain.handle('git:check-repository', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const isRepo = await GitService.isGitRepository(project.path);

      return { success: true, isRepository: isRepo };
    } catch (error) {
      console.error('Error checking git repository:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-status', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const status = await GitService.getGitStatus(project.path);

      return { success: true, status };
    } catch (error) {
      console.error('Error getting git status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-current-branch', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const branch = await GitService.getCurrentBranch(project.path);

      return { success: true, branch };
    } catch (error) {
      console.error('Error getting current branch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-branches', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const branches = await GitService.getBranches(project.path);

      return { success: true, branches };
    } catch (error) {
      console.error('Error getting branches:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-remote-status', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const remoteStatus = await GitService.getRemoteStatus(project.path);

      return { success: true, remoteStatus };
    } catch (error) {
      console.error('Error getting remote status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-recent-commits', async (event, projectId: string, limit: number = 10) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const commits = await GitService.getRecentCommits(project.path, limit);

      return { success: true, commits };
    } catch (error) {
      console.error('Error getting recent commits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:switch-branch', async (event, projectId: string, branchName: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      await GitService.switchBranch(project.path, branchName);

      return { success: true };
    } catch (error) {
      console.error('Error switching branch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:pull', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result = await GitService.pullChanges(project.path);

      return { success: true, result };
    } catch (error) {
      console.error('Error pulling changes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:push', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result = await GitService.pushChanges(project.path);

      return { success: true, result };
    } catch (error) {
      console.error('Error pushing changes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:stage-files', async (event, projectId: string, files: string[]) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // For now, use stageAllChanges as there's no stageFiles method
      // TODO: Add specific stageFiles method to GitService if needed
      const result = await GitService.stageAllChanges(project.path);

      return { success: true, result };
    } catch (error) {
      console.error('Error staging files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:commit', async (event, projectId: string, message: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result = await GitService.commitChanges(project.path, message);

      return { success: true, result };
    } catch (error) {
      console.error('Error committing changes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-diff', async (event, projectId: string, filePath?: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const diff = await GitService.getDiff(project.path, filePath);

      return { success: true, diff };
    } catch (error) {
      console.error('Error getting diff:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-changed-files', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const files = await GitService.getChangedFiles(project.path);

      return { success: true, files };
    } catch (error) {
      console.error('Error getting changed files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:create-stash', async (event, projectId: string, message?: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result = await GitService.createStash(project.path, message);

      return result;
    } catch (error) {
      console.error('Error creating stash:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:get-stashes', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const stashes = await GitService.getStashes(project.path);

      return { success: true, stashes };
    } catch (error) {
      console.error('Error getting stashes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:apply-stash', async (event, projectId: string, stashIndex: number) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result = await GitService.applyStash(project.path, stashIndex);

      return result;
    } catch (error) {
      console.error('Error applying stash:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:drop-stash', async (event, projectId: string, stashIndex: number) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result = await GitService.dropStash(project.path, stashIndex);

      return result;
    } catch (error) {
      console.error('Error dropping stash:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('git:pop-stash', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const result = await GitService.popStash(project.path);

      return result;
    } catch (error) {
      console.error('Error popping stash:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Docker Integration IPC handlers
  ipcMain.handle('docker:detect-configuration', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const config = await DockerService.detectDockerConfiguration(project.path);

      return {
        success: true,
        config
      };
    } catch (error) {
      console.error('Error detecting Docker configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('docker:generate-scripts', async (event, projectId: string) => {
    try {
      const project = storeService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const config = await DockerService.detectDockerConfiguration(project.path);
      const scripts = DockerService.generateDockerScripts(project.path, config);

      return {
        success: true,
        scripts
      };
    } catch (error) {
      console.error('Error generating Docker scripts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('docker:is-available', async () => {
    try {
      const isAvailable = await DockerService.isDockerAvailable();

      return {
        success: true,
        isAvailable
      };
    } catch (error) {
      console.error('Error checking Docker availability:', error);
      return {
        success: false,
        isAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('docker:get-containers', async () => {
    try {
      const containers = await DockerService.getRunningContainers();

      return {
        success: true,
        containers
      };
    } catch (error) {
      console.error('Error getting Docker containers:', error);
      return {
        success: false,
        containers: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('docker:get-images', async () => {
    try {
      const images = await DockerService.getDockerImages();

      return {
        success: true,
        images
      };
    } catch (error) {
      console.error('Error getting Docker images:', error);
      return {
        success: false,
        images: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Background operation handlers
  ipcMain.handle('background:start', async () => {
    try {
      backgroundTaskService.start();
      return { success: true };
    } catch (error) {
      console.error('Error starting background tasks:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('background:stop', async () => {
    try {
      backgroundTaskService.stop();
      return { success: true };
    } catch (error) {
      console.error('Error stopping background tasks:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('background:restart', async () => {
    try {
      backgroundTaskService.restart();
      return { success: true };
    } catch (error) {
      console.error('Error restarting background tasks:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('background:status', async () => {
    try {
      const status = backgroundTaskService.getTaskStatus();
      return { success: true, ...status };
    } catch (error) {
      console.error('Error getting background task status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('background:update-config', async (event, settings: Partial<AppSettings>) => {
    try {
      // Update the settings in store first
      storeService.updateSettings(settings);

      // Get the full updated settings and update background task service
      const fullSettings = storeService.getSettings();
      backgroundTaskService.updateSettings(fullSettings);

      return { success: true };
    } catch (error) {
      console.error('Error updating background task config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Background task IPC handlers
  ipcMain.on('show-background-status', () => {
    if (mainWindow) {
      mainWindow.webContents.send('show-background-status');
    }
  });

  ipcMain.on('restart-background-tasks', () => {
    backgroundTaskService.restart();
    if (mainWindow) {
      mainWindow.webContents.send('background-tasks-restarted');
    }
  });

  ipcMain.on('minimize-to-tray', () => {
    trayService.enableMinimalMode(backgroundTaskService);
  });

  // Terminal IPC handlers
  ipcMain.handle('terminal:create', async (event, options: { id: string; shell?: string; cwd?: string; env?: Record<string, string>; cols?: number; rows?: number }) => {
    try {
      const success = terminalService.createTerminal(options);
      return { success };
    } catch (error) {
      console.error('Error creating terminal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:write', async (event, id: string, data: string) => {
    try {
      const success = terminalService.writeToTerminal(id, data);
      return { success };
    } catch (error) {
      console.error('Error writing to terminal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:resize', async (event, id: string, cols: number, rows: number) => {
    try {
      const success = terminalService.resizeTerminal(id, cols, rows);
      return { success };
    } catch (error) {
      console.error('Error resizing terminal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:kill', async (event, id: string) => {
    try {
      const success = terminalService.killTerminal(id);
      return { success };
    } catch (error) {
      console.error('Error killing terminal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:list', async () => {
    try {
      const terminals = terminalService.getActiveTerminals();
      return { success: true, terminals };
    } catch (error) {
      console.error('Error listing terminals:', error);
      return { success: false, terminals: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:execute', async (event, id: string, command: string) => {
    try {
      const success = terminalService.executeCommand(id, command);
      return { success };
    } catch (error) {
      console.error('Error executing command in terminal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:cd', async (event, id: string, directory: string) => {
    try {
      const success = terminalService.changeDirectory(id, directory);
      return { success };
    } catch (error) {
      console.error('Error changing directory in terminal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:info', async (event, id: string) => {
    try {
      const info = terminalService.getTerminalInfo(id);
      return { success: true, info };
    } catch (error) {
      console.error('Error getting terminal info:', error);
      return { success: false, info: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
};

app.on('ready', async () => {
  // Initialize store and services
  initializeStore();

  // Set up IPC handlers
  setupIpcHandlers();

  // Create the main window
  mainWindow = new BrowserWindow({
    // Use 'app' protocol for file URLs to work correctly with Electron 15+
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      // Additional security measures
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Disable nodeIntegration for security
      nodeIntegration: false,
    },
    // Remove default menu bar
    autoHideMenuBar: true,
    // Enable transparent window
    transparent: true,
    // Frameless window
    frame: false,
    // Initial size
    width: 1200,
    height: 800,
    // Minimum size
    minWidth: 800,
    minHeight: 600,
    // Background color
    backgroundColor: '#ffffff',
    // Icon
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  // Load the index.html file
  mainWindow.loadURL(resolveHtmlPath('index.html'));

  // Open the DevTools initially (for development)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ detach: true });
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize the app menu
  MenuBuilder.buildMenu();
});

// App cleanup handlers
app.on('before-quit', () => {
  // Cleanup terminal service
  if (terminalService) {
    terminalService.cleanup();
  }

  // Cleanup background task service
  if (backgroundTaskService) {
    backgroundTaskService.stop();
  }
});

// Quit the app when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, it's common to keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create the window in the app when the dock icon is clicked and there are no other windows open
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Create a new window if none exist
    mainWindow = new BrowserWindow({
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        enableRemoteModule: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        nodeIntegration: false,
      },
      autoHideMenuBar: true,
      transparent: true,
      frame: false,
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: '#ffffff',
      icon: path.join(__dirname, 'assets', 'icon.png'),
    });

    mainWindow.loadURL(resolveHtmlPath('index.html'));

    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ detach: true });
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    MenuBuilder.buildMenu();
  }
});
