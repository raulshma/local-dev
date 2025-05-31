import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import './TerminalPanel.css';

const { electron } = window;

interface TerminalTab {
  id: string;
  title: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  cwd?: string;
}

interface TerminalPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  projectPath?: string;
  onHeightChange?: (height: number) => void;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({
  isVisible,
  onToggle,
  projectPath,
  onHeightChange
}) => {
  const [terminals, setTerminals] = useState<TerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('');
  const [isResizing, setIsResizing] = useState(false);
  const [panelHeight, setPanelHeight] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Terminal theme configuration
  const terminalTheme = {
    background: 'var(--vscode-terminal-background)',
    foreground: 'var(--vscode-terminal-foreground)',
    cursor: 'var(--vscode-terminal-cursor-foreground)',
    cursorAccent: 'var(--vscode-terminal-cursor-background)',
    selection: 'var(--vscode-terminal-selection-background)',
    black: 'var(--vscode-terminal-ansi-black)',
    red: 'var(--vscode-terminal-ansi-red)',
    green: 'var(--vscode-terminal-ansi-green)',
    yellow: 'var(--vscode-terminal-ansi-yellow)',
    blue: 'var(--vscode-terminal-ansi-blue)',
    magenta: 'var(--vscode-terminal-ansi-magenta)',
    cyan: 'var(--vscode-terminal-ansi-cyan)',
    white: 'var(--vscode-terminal-ansi-white)',
    brightBlack: 'var(--vscode-terminal-ansi-bright-black)',
    brightRed: 'var(--vscode-terminal-ansi-bright-red)',
    brightGreen: 'var(--vscode-terminal-ansi-bright-green)',
    brightYellow: 'var(--vscode-terminal-ansi-bright-yellow)',
    brightBlue: 'var(--vscode-terminal-ansi-bright-blue)',
    brightMagenta: 'var(--vscode-terminal-ansi-bright-magenta)',
    brightCyan: 'var(--vscode-terminal-ansi-bright-cyan)',    brightWhite: 'var(--vscode-terminal-ansi-bright-white)',
  };

  // Handle terminal resize
  const handleTerminalResize = useCallback(async (terminalId: string, cols: number, rows: number) => {
    try {
      await electron.terminal.resize(terminalId, cols, rows);
    } catch (error) {
      console.error('Failed to resize terminal:', error);
    }
  }, []);

  // Create a new terminal tab
  const createTerminal = useCallback(async (title?: string, cwd?: string) => {
    const terminal = new Terminal({
      theme: terminalTheme,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      convertEol: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    const terminalId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const terminalTab: TerminalTab = {
      id: terminalId,
      title: title || `Terminal ${terminals.length + 1}`,
      terminal,
      fitAddon,
      searchAddon,
      cwd: cwd || projectPath,
    };    // Set up terminal data handler - send input to backend
    terminal.onData(async (data) => {
      try {
        await electron.terminal.write(terminalId, data);
      } catch (error) {
        console.error('Failed to write to terminal:', error);
      }
    });

    // Create backend terminal process
    try {
      const result = await electron.terminal.create({
        id: terminalId,
        cwd: cwd || projectPath,
        cols: terminal.cols,
        rows: terminal.rows,
      });

      if (!result.success) {
        console.error('Failed to create terminal:', result.error);
        terminal.writeln(`Error: Failed to create terminal - ${result.error}`);
      } else {
        terminal.writeln(`Terminal ready`);
        terminal.writeln(`Working directory: ${cwd || projectPath || 'Current directory'}`);
      }
    } catch (error) {
      console.error('Failed to create terminal:', error);
      terminal.writeln('Error: Failed to create terminal backend');
    }

    setTerminals(prev => [...prev, terminalTab]);
    setActiveTerminalId(terminalId);

    return terminalTab;
  }, [terminals.length, projectPath, terminalTheme]);
  // Close a terminal tab
  const closeTerminal = useCallback(async (terminalId: string) => {
    setTerminals(prev => {
      const filtered = prev.filter(t => t.id !== terminalId);
      const terminal = prev.find(t => t.id === terminalId);
      if (terminal) {
        terminal.terminal.dispose();
        // Clean up backend terminal
        electron.terminal.kill(terminalId).catch(error => {
          console.error('Failed to kill terminal process:', error);
        });
      }

      // If closing active terminal, switch to another one
      if (terminalId === activeTerminalId && filtered.length > 0) {
        setActiveTerminalId(filtered[0].id);
      } else if (filtered.length === 0) {
        setActiveTerminalId('');
      }

      return filtered;
    });
  }, [activeTerminalId]);

  // Debug: Execute a test command in terminal
  const executeTestCommand = useCallback(async (terminalId: string, command: string) => {
    try {
      const result = await electron.terminal.execute(terminalId, command);
      if (!result.success) {
        console.error('Failed to execute command:', result.error);
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
    }
  }, []);

  // Handle panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newHeight = window.innerHeight - e.clientY;
      const minHeight = 100;
      const maxHeight = window.innerHeight * 0.7;

      const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      setPanelHeight(constrainedHeight);
      onHeightChange?.(constrainedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onHeightChange]);

  // Initialize terminal when panel becomes visible
  useEffect(() => {
    if (isVisible && terminals.length === 0) {
      createTerminal('Terminal 1', projectPath);
    }
  }, [isVisible, terminals.length, createTerminal, projectPath]);
  // Fit terminals when panel resizes or becomes visible
  useEffect(() => {
    if (isVisible && terminals.length > 0) {
      const activeTerminal = terminals.find(t => t.id === activeTerminalId);
      if (activeTerminal) {
        setTimeout(() => {
          activeTerminal.fitAddon.fit();
          // Notify backend of resize
          handleTerminalResize(activeTerminal.id, activeTerminal.terminal.cols, activeTerminal.terminal.rows);
        }, 100);
      }
    }
  }, [isVisible, panelHeight, terminals, activeTerminalId, handleTerminalResize]);

  // Attach terminal to DOM when active terminal changes
  useEffect(() => {
    const activeTerminal = terminals.find(t => t.id === activeTerminalId);
    if (activeTerminal && containerRef.current) {
      const terminalContainer = containerRef.current.querySelector('.terminal-content');
      if (terminalContainer) {
        // Clear previous content
        terminalContainer.innerHTML = '';
        // Attach new terminal
        activeTerminal.terminal.open(terminalContainer as HTMLElement);
        setTimeout(() => {
          activeTerminal.fitAddon.fit();
        }, 50);
      }
    }
  }, [activeTerminalId, terminals]);  // Set up terminal event listeners
  useEffect(() => {
    // Listen for terminal data from backend
    const removeDataListener = electron.ipcRenderer.on('terminal:data', (...args: unknown[]) => {
      const id = args[0] as string;
      const data = args[1] as string;
      const terminal = terminals.find(t => t.id === id);
      if (terminal) {
        terminal.terminal.write(data);
      }
    });

    // Listen for terminal exit events
    const removeExitListener = electron.ipcRenderer.on('terminal:exit', (...args: unknown[]) => {
      const id = args[0] as string;
      const code = args[1] as number;
      const terminal = terminals.find(t => t.id === id);
      if (terminal) {
        terminal.terminal.writeln(`\r\nProcess exited with code ${code}`);
        terminal.terminal.write('$ ');
      }
    });

    // Listen for terminal error events
    const removeErrorListener = electron.ipcRenderer.on('terminal:error', (...args: unknown[]) => {
      const id = args[0] as string;
      const error = args[1] as string;
      const terminal = terminals.find(t => t.id === id);
      if (terminal) {
        terminal.terminal.writeln(`\r\nTerminal error: ${error}`);
        terminal.terminal.write('$ ');
      }
    });

    return () => {
      removeDataListener();
      removeExitListener();
      removeErrorListener();
    };
  }, [terminals]);

  if (!isVisible) return null;

  return (
    <div
      className="terminal-panel"
      style={{ height: panelHeight }}
      ref={containerRef}
    >
      {/* Resize Handle */}
      <div
        ref={resizeHandleRef}
        className="terminal-resize-handle"
        onMouseDown={() => setIsResizing(true)}
      />

      {/* Terminal Header */}
      <div className="terminal-header">
        <div className="terminal-tabs">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`terminal-tab ${terminal.id === activeTerminalId ? 'active' : ''}`}
              onClick={() => setActiveTerminalId(terminal.id)}
            >
              <span className="terminal-tab-title">{terminal.title}</span>
              <button
                className="terminal-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminal.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="terminal-new-tab"
            onClick={() => createTerminal()}
            title="New Terminal"
          >
            +
          </button>
        </div>
          <div className="terminal-actions">
          <button
            className="terminal-action"
            onClick={() => {
              const activeTerminal = terminals.find(t => t.id === activeTerminalId);
              if (activeTerminal) {
                executeTestCommand(activeTerminal.id, 'echo "Terminal test successful!"');
              }
            }}
            title="Test Terminal"
          >
            🧪
          </button>
          <button
            className="terminal-action"
            onClick={() => {
              const activeTerminal = terminals.find(t => t.id === activeTerminalId);
              if (activeTerminal) {
                activeTerminal.terminal.clear();
              }
            }}
            title="Clear Terminal"
          >
            🗑️
          </button>
          <button
            className="terminal-action"
            onClick={onToggle}
            title="Hide Terminal"
          >
            ⬇️
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="terminal-content-wrapper">
        <div className="terminal-content" />
      </div>
    </div>
  );
};

export default TerminalPanel;
