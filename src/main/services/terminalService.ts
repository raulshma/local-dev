/**
 * Terminal Service
 * Manages terminal instances and processes for the Local Dev Environment Dashboard
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';

export interface TerminalOptions {
  id: string;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface TerminalData {
  id: string;
  data: string;
}

export interface TerminalProcess {
  id: string;
  process: ChildProcess;
  cwd: string;
  shell: string;
  isActive: boolean;
  commandBuffer: string;
  currentCommandProcess?: ChildProcess; // Track the currently running command process
}

class TerminalService extends EventEmitter {
  public terminals: Map<string, TerminalProcess> = new Map();
  private isWindows: boolean = os.platform() === 'win32';

  constructor() {
    super();
  }

  /**
   * Create a new terminal instance
   */
  public createTerminal(options: TerminalOptions): boolean {
    try {
      const { id, shell, cwd = process.cwd(), env = {}, cols = 80, rows = 24 } = options;

      // Determine shell based on platform
      let shellPath: string;
      let shellArgs: string[] = [];

      if (this.isWindows) {
        // Windows: Use PowerShell for better command execution
        shellPath = shell || 'powershell.exe';
        if (shellPath.includes('powershell') || shellPath.includes('pwsh')) {
          shellArgs = ['-NoLogo', '-NoProfile', '-Command', '-'];
        } else if (shellPath.includes('cmd')) {
          shellArgs = [];
        }
      } else {
        // Unix-like: Use bash by default
        shellPath = shell || '/bin/bash';
        shellArgs = ['-l']; // Login shell
      }

      // Combine environment variables - following the same pattern as IDE opening
      const processEnv = {
        // Only pass essential environment variables, following IDE opening pattern
        PATH: process.env.PATH,
        COLUMNS: cols.toString(),
        LINES: rows.toString(),
        PWD: cwd,
      };

      if (this.isWindows) {
        // Windows-specific environment variables
        Object.assign(processEnv, {
          USERPROFILE: process.env.USERPROFILE,
          APPDATA: process.env.APPDATA,
          LOCALAPPDATA: process.env.LOCALAPPDATA,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          COMSPEC: process.env.COMSPEC,
        });
      } else {
        // Unix-specific environment variables
        Object.assign(processEnv, {
          HOME: process.env.HOME,
          USER: process.env.USER,
          SHELL: process.env.SHELL,
          TERM: 'xterm-256color',
        });
      }

      // Add any custom environment variables
      Object.assign(processEnv, env);

      // For Windows, we'll use regular spawn since node-pty is not available
      const terminalProcess = spawn(shellPath, shellArgs, {
        cwd,
        env: processEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });

      if (!terminalProcess.pid) {
        throw new Error('Failed to spawn terminal process');
      }

      const terminal: TerminalProcess = {
        id,
        process: terminalProcess,
        cwd,
        shell: shellPath,
        isActive: true,
        commandBuffer: '',
      };

      this.terminals.set(id, terminal);

      // Set up event handlers
      this.setupTerminalHandlers(terminal);

      this.emit('terminalCreated', { id, pid: terminalProcess.pid });

      // Send initial prompt
      setTimeout(() => {
        this.emit('terminalData', {
          id,
          data: `${cwd}> `,
        });
      }, 500);

      return true;
    } catch (error) {
      console.error('Failed to create terminal:', error);
      this.emit('terminalError', { id: options.id, error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Write data to a terminal
   */
  public writeToTerminal(id: string, data: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal || !terminal.isActive) {
      return false;
    }

    try {
      const charCode = data.charCodeAt(0);

      if (charCode === 3) { // Ctrl+C - interrupt command
        this.interruptCommand(terminal);
        return true;
      } else if (charCode === 13) { // Enter key - execute command
        this.executeCommandInTerminal(terminal, terminal.commandBuffer);
        terminal.commandBuffer = '';
      } else if (charCode === 8 || charCode === 127) { // Backspace
        if (terminal.commandBuffer.length > 0) {
          terminal.commandBuffer = terminal.commandBuffer.slice(0, -1);
          // Echo backspace
          this.emit('terminalData', {
            id,
            data: '\b \b',
          });
        }
      } else if (charCode >= 32 && charCode <= 126) { // Printable characters
        terminal.commandBuffer += data;
        // Echo the character
        this.emit('terminalData', {
          id,
          data: data,
        });
      }

      return true;
    } catch (error) {
      console.error(`Failed to write to terminal ${id}:`, error);
      return false;
    }
  }

  /**
   * Resize a terminal
   */
  public resizeTerminal(id: string, cols: number, rows: number): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal || !terminal.isActive) {
      return false;
    }

    try {
      // For basic spawn, we can't resize the PTY, but we can update env vars
      // This is a limitation without node-pty
      return true;
    } catch (error) {
      console.error(`Failed to resize terminal ${id}:`, error);
      return false;
    }
  }

  /**
   * Kill a terminal
   */
  public killTerminal(id: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return false;
    }

    try {
      terminal.isActive = false;

      if (this.isWindows) {
        // On Windows, use taskkill for better process cleanup
        spawn('taskkill', ['/pid', terminal.process.pid?.toString() || '', '/T', '/F'], {
          stdio: 'ignore',
        });
      } else {
        terminal.process.kill('SIGTERM');

        // Force kill if it doesn't terminate gracefully
        setTimeout(() => {
          if (!terminal.process.killed) {
            terminal.process.kill('SIGKILL');
          }
        }, 5000);
      }

      this.terminals.delete(id);
      this.emit('terminalClosed', { id });

      return true;
    } catch (error) {
      console.error(`Failed to kill terminal ${id}:`, error);
      return false;
    }
  }

  /**
   * Get list of active terminals
   */
  public getActiveTerminals(): string[] {
    return Array.from(this.terminals.keys()).filter(id => {
      const terminal = this.terminals.get(id);
      return terminal && terminal.isActive;
    });
  }

  /**
   * Check if a terminal exists and is active
   */
  public hasTerminal(id: string): boolean {
    const terminal = this.terminals.get(id);
    return terminal ? terminal.isActive : false;
  }

  /**
   * Get terminal information
   */
  public getTerminalInfo(id: string): Partial<TerminalProcess> | null {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return null;
    }

    return {
      id: terminal.id,
      cwd: terminal.cwd,
      shell: terminal.shell,
      isActive: terminal.isActive,
    };
  }

  /**
   * Execute a command in a terminal
   */
  public executeCommand(id: string, command: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal || !terminal.isActive) {
      return false;
    }

    try {
      // Add newline to execute the command
      const commandWithNewline = command.endsWith('\n') ? command : command + '\n';
      terminal.process.stdin?.write(commandWithNewline);
      return true;
    } catch (error) {
      console.error(`Failed to execute command in terminal ${id}:`, error);
      return false;
    }
  }

  /**
   * Change directory for a terminal
   */
  public changeDirectory(id: string, directory: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal || !terminal.isActive) {
      return false;
    }

    try {
      // Update the terminal's current working directory
      terminal.cwd = directory;

      // Emit a message to show the directory change
      this.emit('terminalData', {
        id,
        data: `\r\nChanged directory to: ${directory}\r\n${directory}> `,
      });

      return true;
    } catch (error) {
      console.error(`Failed to change directory in terminal ${id}:`, error);
      return false;
    }
  }

  /**
   * Clean up all terminals
   */
  public cleanup(): void {
    for (const [id] of this.terminals) {
      this.killTerminal(id);
    }
    this.terminals.clear();
  }

  /**
   * Set up event handlers for a terminal process
   */
  private setupTerminalHandlers(terminal: TerminalProcess): void {
    const { id, process } = terminal;

    // Handle stdout data
    process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.emit('terminalData', {
        id,
        data: output,
      });
    });

    // Handle stderr data
    process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.emit('terminalData', {
        id,
        data: output,
      });
    });

    // Handle process exit
    process.on('exit', (code: number | null, signal: string | null) => {
      terminal.isActive = false;
      this.terminals.delete(id);
      this.emit('terminalExit', {
        id,
        code,
        signal,
      });
    });

    // Handle process errors
    process.on('error', (error: Error) => {
      terminal.isActive = false;
      this.emit('terminalError', {
        id,
        error: error.message,
      });
    });
  }

  /**
   * Execute a command in a terminal and capture output
   */
  private executeCommandInTerminal(terminal: TerminalProcess, command: string): void {
    if (!command.trim()) {
      // Empty command, just show prompt
      this.emit('terminalData', {
        id: terminal.id,
        data: `\r\n${terminal.cwd}> `,
      });
      return;
    }

    // Handle special commands and aliases (following IDE pattern of preprocessing)
    let processedCommand = command.trim();

    if (this.isWindows) {
      // Windows command preprocessing - add common aliases
      const aliases: Record<string, string> = {
        'ls': 'dir',
        'pwd': 'cd',
        'clear': 'cls',
        'cat': 'type',
        'which': 'where',
      };

      const commandParts = processedCommand.split(' ');
      const baseCommand = commandParts[0].toLowerCase();

      if (aliases[baseCommand]) {
        commandParts[0] = aliases[baseCommand];
        processedCommand = commandParts.join(' ');
      }
    }

    // Emit the command echo (newline to go to next line)
    this.emit('terminalData', {
      id: terminal.id,
      data: `\r\n`,
    });

    // Execute the command following the same pattern as IDE opening
    let execProcess: ChildProcess;

    if (this.isWindows) {
      // Windows: Use cmd.exe with /c flag, following the same pattern as IDE opening
      execProcess = spawn('cmd.exe', ['/c', processedCommand], {
        cwd: terminal.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          // Only pass essential environment variables, following IDE opening pattern
          PATH: process.env.PATH,
          USERPROFILE: process.env.USERPROFILE,
          APPDATA: process.env.APPDATA,
          LOCALAPPDATA: process.env.LOCALAPPDATA,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          // Explicitly exclude Node.js related environment variables
          // that might cause issues
        }
      });
    } else {
      // Unix-like: Use bash with -c flag
      execProcess = spawn('/bin/bash', ['-c', processedCommand], {
        cwd: terminal.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // Clean environment for Unix systems too
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          USER: process.env.USER,
          SHELL: process.env.SHELL,
        }
      });
    }

    // Store the current command process so it can be interrupted
    terminal.currentCommandProcess = execProcess;

    // Handle output - capture both stdout and stderr
    execProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.emit('terminalData', {
        id: terminal.id,
        data: output,
      });
    });

    execProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.emit('terminalData', {
        id: terminal.id,
        data: output,
      });
    });

    execProcess.on('close', (code: number | null) => {
      // Clear the current command process reference
      terminal.currentCommandProcess = undefined;
      // Show prompt after command completion
      this.emit('terminalData', {
        id: terminal.id,
        data: `\r\n${terminal.cwd}> `,
      });
    });

    execProcess.on('error', (error: Error) => {
      console.error(`Command execution error:`, error);
      // Clear the current command process reference
      terminal.currentCommandProcess = undefined;
      this.emit('terminalData', {
        id: terminal.id,
        data: `Error: ${error.message}\r\n${terminal.cwd}> `,
      });
    });
  }

  /**
   * Interrupt the currently running command in a terminal (Ctrl+C)
   */
  public interruptCommand(terminal: TerminalProcess): boolean {
    if (!terminal || !terminal.isActive) {
      return false;
    }

    try {
      // If there's a running command process, interrupt it
      if (terminal.currentCommandProcess && !terminal.currentCommandProcess.killed) {
        if (this.isWindows) {
          // On Windows, use taskkill to forcefully terminate the process tree
          const pid = terminal.currentCommandProcess.pid;
          if (pid) {
            spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], {
              stdio: 'ignore',
            });
          }
        } else {
          // On Unix-like systems, send SIGINT
          terminal.currentCommandProcess.kill('SIGINT');
        }

        // Clear the current command process reference
        terminal.currentCommandProcess = undefined;

        // Show ^C in terminal and new prompt
        this.emit('terminalData', {
          id: terminal.id,
          data: `^C\r\n${terminal.cwd}> `,
        });

        return true;
      } else {
        // No running command, just show ^C and clear command buffer
        terminal.commandBuffer = '';
        this.emit('terminalData', {
          id: terminal.id,
          data: `^C\r\n${terminal.cwd}> `,
        });

        return true;
      }
    } catch (error) {
      console.error(`Failed to interrupt command in terminal ${terminal.id}:`, error);
      return false;
    }
  }
}

export default TerminalService;
