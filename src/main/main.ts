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
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { spawn, ChildProcess, exec, execSync } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import os from 'os';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import StoreService from './services/store';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let storeService: StoreService;

// Track running processes
const runningProcesses = new Map<string, ChildProcess>();

// Initialize store service
const initializeStore = () => {
  storeService = new StoreService();
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

      // Stop existing process if running
      const processKey = `${projectId}:${scriptId}`;
      if (runningProcesses.has(processKey)) {
        const existingProcess = runningProcesses.get(processKey);
        existingProcess?.kill('SIGTERM');
        runningProcesses.delete(processKey);
      }

      // Parse command and arguments
      const commandParts = script.command.split(' ');
      const command = commandParts[0];
      const args = commandParts.slice(1);

      // Start new process
      const childProcess = spawn(command, args, {
        cwd: project.path,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Store process reference
      runningProcesses.set(processKey, childProcess);

      // Set up output streaming
      childProcess.stdout?.on('data', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('script:output', {
            projectId,
            scriptId,
            type: 'stdout',
            data: data.toString()
          });
        }
      });

      childProcess.stderr?.on('data', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('script:output', {
            projectId,
            scriptId,
            type: 'stderr',
            data: data.toString()
          });
        }
      });

      childProcess.on('close', (code) => {
        runningProcesses.delete(processKey);
        if (mainWindow) {
          mainWindow.webContents.send('script:status', {
            projectId,
            scriptId,
            status: 'stopped',
            exitCode: code
          });
        }
      });

      childProcess.on('error', (error) => {
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

      // Send started status
      if (mainWindow) {
        mainWindow.webContents.send('script:status', {
          projectId,
          scriptId,
          status: 'running'
        });
      }

      return { success: true, pid: childProcess.pid };
    } catch (error) {
      console.error('Error executing script:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('script:stop', async (event, projectId: string, scriptId: string) => {
    try {
      const processKey = `${projectId}:${scriptId}`;
      const process = runningProcesses.get(processKey);
      
      if (!process) {
        return { success: false, error: 'Process not found' };
      }

      process.kill('SIGTERM');
      
      // Force kill after 5 seconds if not terminated
      setTimeout(() => {
        if (runningProcesses.has(processKey)) {
          process.kill('SIGKILL');
        }
      }, 5000);

      return { success: true };
    } catch (error) {
      console.error('Error stopping script:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('script:is-running', async (event, projectId: string, scriptId: string) => {
    const processKey = `${projectId}:${scriptId}`;
    return runningProcesses.has(processKey);
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
      let ideCommand = effectiveSettings.ideCommand;
      const projectPath = project.path;

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

      // Resolve IDE path on Windows
      ideCommand = findIDEPath(ideCommand);

      // Try to detect and use available IDEs if the configured one fails
      const availableIDEs = ['code', 'cursor', 'subl', 'atom', 'webstorm'];
      
      // Log what IDEs we can find
      console.log('Checking available IDEs...');
      for (const ide of availableIDEs) {
        const resolvedPath = findIDEPath(ide);
        console.log(`${ide}: ${resolvedPath} ${resolvedPath !== ide ? '(resolved)' : '(command)'}`);
      }
      
      const tryIDE = (command: string): boolean => {
        try {
          console.log(`Trying to execute: ${command} "${projectPath}"`);
          if (process.platform === 'win32') {
            // On Windows, use a simpler approach with cmd.exe
            if (command.includes('\\') && existsSync(command)) {
              // Full path - execute directly with start command to properly detach
              execSync(`"${command}" "${projectPath}"`, {
                stdio: 'ignore',
                timeout: 5000,
                windowsHide: false
              });
              console.log(`Successfully launched IDE: ${command}`);
              return true;
            } else {
              // Command in PATH - use start to launch properly
              execSync(`start "" ${command} "${projectPath}"`, {
                stdio: 'ignore',
                timeout: 5000,
                windowsHide: true
              });
              console.log(`Successfully launched IDE: ${command}`);
              return true;
            }
          } else {
            // On macOS/Linux, use spawn with proper detachment
            const result = spawn(command, [projectPath], {
              detached: true,
              stdio: 'ignore',
              env: { ...process.env, PATH: process.env.PATH }
            });
            
            if (result.pid) {
              result.unref();
              console.log(`Successfully launched IDE with PID: ${result.pid}`);
              return true;
            }
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`Failed to execute "${command}":`, errorMessage);
          return false;
        }
      };

      // First try the configured IDE
      ideCommand = findIDEPath(ideCommand); // Resolve IDE path on Windows
      if (tryIDE(ideCommand)) {
        return { success: true };
      }

      // If configured IDE failed, try to find an available one
      console.warn(`IDE command "${ideCommand}" failed, trying to detect available IDEs...`);
      
      for (const ide of availableIDEs) {
        if (ide !== ideCommand) {
          const resolvedIdePath = findIDEPath(ide);
          if (tryIDE(resolvedIdePath)) {
            console.log(`Successfully opened project with ${resolvedIdePath}`);
            
            return { 
              success: true, 
              message: `Opened with ${ide} (${ideCommand} was not available)` 
            };
          }
        }
      }

      // If all command line attempts failed, try using shell.openPath as last resort
      console.warn('All IDE commands failed, trying to open folder with default application...');
      try {
        await shell.openPath(projectPath);
        return { 
          success: true, 
          message: 'Opened project folder with default application (IDE commands unavailable from app context)' 
        };
      } catch (shellError) {
        console.error('Shell openPath also failed:', shellError);
      }

      // If all IDEs failed, provide helpful error message
      throw new Error(
        `Could not open project in any IDE. Tried: ${ideCommand}, ${availableIDEs.join(', ')}. ` +
        `Please ensure at least one IDE is installed and available in your system PATH, or ` +
        `configure a custom IDE command in project settings. ` +
        `Note: Commands work fine in terminal but may need full path when run from app.`
      );

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

      let command: string;
      
      console.log(`Opening terminal for project: ${project.name} at path: ${projectPath}`);
      
      // If user has specified a custom terminal command, use it
      if (effectiveSettings.terminalCommand) {
        command = `"${effectiveSettings.terminalCommand}" "${projectPath}"`;
        console.log(`Using custom terminal command: ${command}`);
      } else {
        // OS-specific terminal commands
        switch (platform) {
          case 'darwin':
            // macOS
            command = `open -a Terminal "${projectPath}"`;
            break;
          case 'win32':
            // Windows - prefer PowerShell but fallback to cmd
            command = `start powershell -NoExit -Command "Set-Location '${projectPath}'"`;
            break;
          case 'linux':
          default:
            // Linux - try common terminals in order of preference
            const terminals = ['gnome-terminal', 'konsole', 'xfce4-terminal', 'x-terminal-emulator'];
            command = `${terminals[0]} --working-directory="${projectPath}"`;
            break;
        }
        console.log(`Using platform-specific terminal command: ${command}`);
      }

      return new Promise((resolve) => {
        exec(command, (error) => {
          if (error) {
            console.error('Error opening terminal:', error);
            resolve({ success: false, error: error.message });
          } else {
            console.log('Successfully opened terminal');
            resolve({ success: true });
          }
        });
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

  ipcMain.handle('settings:update', async (event, settings: Partial<{ ideCommand: string; terminalCommand?: string }>) => {
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
