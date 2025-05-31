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
}

class TerminalService extends EventEmitter {
  private terminals: Map<string, TerminalProcess> = new Map();
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
        // Windows: Use PowerShell by default
        shellPath = shell || 'powershell.exe';
        if (shellPath.includes('powershell')) {
          shellArgs = ['-NoLogo', '-NoProfile'];
        } else if (shellPath.includes('cmd')) {
          shellArgs = ['/K'];
        }
      } else {
        // Unix-like: Use bash by default
        shellPath = shell || '/bin/bash';
        shellArgs = ['-l']; // Login shell
      }

      // Combine environment variables
      const processEnv = {
        ...process.env,
        ...env,
        TERM: 'xterm-256color',
        COLUMNS: cols.toString(),
        LINES: rows.toString(),
        PWD: cwd,
      };

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
      };

      this.terminals.set(id, terminal);

      // Set up event handlers
      this.setupTerminalHandlers(terminal);

      this.emit('terminalCreated', { id, pid: terminalProcess.pid });

      return true;
    } catch (error) {
      console.error('Failed to create terminal:', error);
      this.emit('terminalError', { id: options.id, error: error.message });
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
      terminal.process.stdin?.write(data);
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
      console.log(`Terminal ${id} resize requested: ${cols}x${rows}`);
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
      const cdCommand = this.isWindows ? `cd "${directory}"\n` : `cd "${directory}"\n`;
      terminal.process.stdin?.write(cdCommand);
      terminal.cwd = directory;
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
      this.emit('terminalData', {
        id,
        data: data.toString(),
      });
    });

    // Handle stderr data
    process.stderr?.on('data', (data: Buffer) => {
      this.emit('terminalData', {
        id,
        data: data.toString(),
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
}

export default TerminalService;
