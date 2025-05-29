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
import { AppSettings } from '../types';

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

// Track running processes
const runningProcesses = new Map<string, ChildProcess>();

// Initialize store service
const initializeStore = () => {
  storeService = new StoreService();
  projectDetectionService = new ProjectDetectionService();
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
      
      return project;
    } catch (error) {
      console.error('Error adding project:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  });

  ipcMain.handle('project:remove', async (event, id: string) => {
    try {
      const success = storeService.removeProject(id);
      if (!success) {
        throw new Error('Project not found');
      }
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
        existingProcess?.kill('SIGTERM');
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
            throw new Error('Failed to start script process: No PID obtained');
          }

          console.log(`Successfully started script process with PID: ${childProcess.pid}`);
        } catch (windowsSpawnError) {
          console.error('Error spawning script on Windows:', windowsSpawnError);
          throw new Error(`Failed to execute script on Windows: ${windowsSpawnError instanceof Error ? windowsSpawnError.message : 'Unknown error'}`);
        }
      } else {
        // For non-Windows platforms
        console.log('Executing script on non-Windows platform');
        
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
            throw new Error('Failed to start script process: No PID obtained');
          }

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
      const process = runningProcesses.get(processKey);
      
      console.log(`Attempting to stop script: ${scriptId} for project: ${projectId}`);
      
      if (!process) {
        console.log(`No running process found for script: ${scriptId}`);
        return { 
          success: false, 
          error: 'Process not found or already stopped',
          scriptId,
          projectId
        };
      }

      console.log(`Terminating process with PID: ${process.pid} for script: ${scriptId}`);
      
      // Send SIGTERM first for graceful shutdown
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds if not terminated gracefully
      const forceKillTimeout = setTimeout(() => {
        if (runningProcesses.has(processKey)) {
          console.log(`Force killing script process: ${scriptId} (SIGKILL)`);
          process.kill('SIGKILL');
          runningProcesses.delete(processKey);
          
          // Send force stopped status
          if (mainWindow) {
            mainWindow.webContents.send('script:status', {
              projectId,
              scriptId,
              status: 'force-stopped',
              message: 'Process was force killed after graceful shutdown timeout'
            });
          }
        }
      }, 5000);

      // Clear timeout if process terminates gracefully
      process.on('exit', () => {
        clearTimeout(forceKillTimeout);
        console.log(`Script process ${scriptId} terminated gracefully`);
      });

      return { 
        success: true, 
        message: `Termination signal sent to script: ${scriptId}`,
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
};

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getAssetPath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    backgroundColor: '#1e1e1e', // VS Code dark background
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    initializeStore();
    setupIpcHandlers();
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
