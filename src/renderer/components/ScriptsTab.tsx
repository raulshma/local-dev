import React, { useState, useEffect } from 'react';
import { Project, ProjectScript, ScriptExecutionHistory } from '../../types';
import { useApp } from '../contexts/AppContext';
import {
  PlusIcon,
  PlayIcon,
  CloseIcon,
  SettingsIcon,
  EditIcon,
  TerminalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  TrashIcon
} from './Icons';
import { ColorCodedOutput } from './ColorCodedOutput';

interface ScriptsTabProps {
  project: Project;
  onAddScript: (script: { name: string; command: string }) => void;
  onRemoveScript: (scriptId: string) => void;
  onUpdateScript: (script: ProjectScript) => void;
  onExecuteScript: (scriptId: string) => void;
  onStopScript: (scriptId: string) => void;
}

const ScriptsTab: React.FC<ScriptsTabProps> = ({
  project,
  onAddScript,
  onRemoveScript,
  onUpdateScript,
  onExecuteScript,
  onStopScript,
}) => {
  const { runningScripts, scriptOutput, clearScriptOutput, toggleScriptOutput, refreshAutoScripts } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingScript, setEditingScript] = useState<ProjectScript | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptCommand, setScriptCommand] = useState('');
  const [activeOutputTab, setActiveOutputTab] = useState<'current' | 'history'>('current');
  const [executionHistory, setExecutionHistory] = useState<ScriptExecutionHistory[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedScript, setSelectedScript] = useState<string | null>(null);

  // Multiple concurrent script views state
  interface ScriptView {
    id: string;
    scriptId: string;
    scriptName: string;
    isPinned: boolean;
    isMinimized: boolean;
    activeTab: 'current' | 'history';
  }

  const [scriptViews, setScriptViews] = useState<ScriptView[]>([]);
  const [activeScriptViewId, setActiveScriptViewId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'tabs' | 'split'>('single');

  const isScriptRunning = (scriptId: string) => {
    return runningScripts.has(`${project.id}:${scriptId}`);
  };

  // Load execution history
  useEffect(() => {
    loadExecutionHistory();
  }, [project.id]);

  // Refresh history when scripts complete
  useEffect(() => {
    // Check if any script just stopped running
    const runningProjectScripts = Array.from(runningScripts.keys())
      .filter(key => key.startsWith(`${project.id}:`));

    // If we had running scripts and now we have fewer, refresh history
    // This is a simple heuristic to detect when scripts complete
    const timeout = setTimeout(() => {
      loadExecutionHistory();
    }, 1000); // Small delay to allow history to be updated

    return () => clearTimeout(timeout);
  }, [runningScripts.size, project.id]);

  const loadExecutionHistory = async () => {
    try {
      const result = await window.electron.script.getExecutionHistory(project.id);
      if (result.success && result.history) {
        setExecutionHistory(result.history);
      }
    } catch (error) {
      console.error('Error loading execution history:', error);
    }
  };

  const clearExecutionHistory = async () => {
    if (window.confirm('Are you sure you want to clear all execution history? This action cannot be undone.')) {
      try {
        const result = await window.electron.script.clearExecutionHistory(project.id);
        if (result.success) {
          setExecutionHistory([]);
        }
      } catch (error) {
        console.error('Error clearing execution history:', error);
      }
    }
  };

  const formatDuration = (milliseconds: number) => {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
    return `${(milliseconds / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string, exitCode?: number) => {
    switch (status) {
      case 'running': return 'var(--vscode-charts-blue)';
      case 'completed': return exitCode === 0 ? 'var(--vscode-charts-green)' : 'var(--vscode-charts-orange)';
      case 'failed': return 'var(--vscode-charts-red)';
      case 'cancelled': return 'var(--vscode-charts-yellow)';
      default: return 'var(--vscode-foreground)';
    }
  };

  // Script view management functions
  const createScriptView = (scriptId: string, scriptName: string) => {
    const viewId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newView: ScriptView = {
      id: viewId,
      scriptId,
      scriptName,
      isPinned: false,
      isMinimized: false,
      activeTab: 'current'
    };

    setScriptViews(prev => [...prev, newView]);
    setActiveScriptViewId(viewId);
    if (scriptViews.length === 0) {
      setViewMode('tabs');
    }
  };

  const closeScriptView = (viewId: string) => {
    setScriptViews(prev => {
      const filtered = prev.filter(view => view.id !== viewId);
      if (filtered.length === 0) {
        setViewMode('single');
        setActiveScriptViewId(null);
      } else if (activeScriptViewId === viewId) {
        setActiveScriptViewId(filtered[0].id);
      }
      return filtered;
    });
  };

  const togglePinView = (viewId: string) => {
    setScriptViews(prev => prev.map(view =>
      view.id === viewId ? { ...view, isPinned: !view.isPinned } : view
    ));
  };

  const toggleMinimizeView = (viewId: string) => {
    setScriptViews(prev => prev.map(view =>
      view.id === viewId ? { ...view, isMinimized: !view.isMinimized } : view
    ));
  };

  const stopAllScripts = () => {
    const runningProjectScripts = Array.from(runningScripts.keys())
      .filter(key => key.startsWith(`${project.id}:`))
      .map(key => key.split(':')[1]);

    runningProjectScripts.forEach(scriptId => {
      onStopScript(scriptId);
    });
  };

  const handleScriptClick = (script: ProjectScript) => {
    if (viewMode === 'single') {
      setSelectedScript(script.id);
    } else {
      // Check if view already exists
      const existingView = scriptViews.find(view => view.scriptId === script.id);
      if (existingView) {
        setActiveScriptViewId(existingView.id);
      } else {
        createScriptView(script.id, script.name);
      }
    }
  };

  const filteredHistory = executionHistory.filter(entry => {
    if (!historySearch.trim()) return true;
    const searchLower = historySearch.toLowerCase();
    return (
      entry.scriptName.toLowerCase().includes(searchLower) ||
      entry.command.toLowerCase().includes(searchLower) ||
      entry.output.toLowerCase().includes(searchLower)
    );
  });

  const handleAddScript = () => {
    if (!scriptName.trim() || !scriptCommand.trim()) return;

    onAddScript({
      name: scriptName.trim(),
      command: scriptCommand.trim()
    });

    setScriptName('');
    setScriptCommand('');
    setShowAddModal(false);
  };

  const handleEditScript = (script: ProjectScript) => {
    setEditingScript(script);
    setScriptName(script.name);
    setScriptCommand(script.command);
    setShowAddModal(true);
  };

  const handleUpdateScript = () => {
    if (!editingScript || !scriptName.trim() || !scriptCommand.trim()) return;

    onUpdateScript({
      ...editingScript,
      name: scriptName.trim(),
      command: scriptCommand.trim()
    });

    setEditingScript(null);
    setScriptName('');
    setScriptCommand('');
    setShowAddModal(false);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingScript(null);
    setScriptName('');
    setScriptCommand('');
  };

  const handleScriptAction = (script: ProjectScript) => {
    if (isScriptRunning(script.id)) {
      onStopScript(script.id);
    } else {
      onExecuteScript(script.id);
    }
  };

  // Render tabbed script view interface
  const renderTabbedScriptView = () => {
    if (viewMode === 'single' || scriptViews.length === 0) return null;

    const activeView = scriptViews.find(view => view.id === activeScriptViewId);
    const runningCount = Array.from(runningScripts.keys())
      .filter(key => key.startsWith(`${project.id}:`)).length;

    return (
      <div className="tabbed-script-view">
        <div className="script-view-header">
          <div className="script-view-tabs">
            {scriptViews.map(view => (
              <div
                key={view.id}
                className={`script-view-tab ${view.id === activeScriptViewId ? 'active' : ''} ${view.isPinned ? 'pinned' : ''}`}
                onClick={() => setActiveScriptViewId(view.id)}
              >
                <span className="tab-name">{view.scriptName}</span>
                {isScriptRunning(view.scriptId) && <span className="running-indicator"></span>}
                <button
                  className="tab-pin-btn"
                  onClick={(e) => { e.stopPropagation(); togglePinView(view.id); }}
                  title={view.isPinned ? 'Unpin' : 'Pin'}
                >
                  📌
                </button>
                <button
                  className="tab-minimize-btn"
                  onClick={(e) => { e.stopPropagation(); toggleMinimizeView(view.id); }}
                  title={view.isMinimized ? 'Restore' : 'Minimize'}
                >
                  {view.isMinimized ? '🔼' : '🔽'}
                </button>
                <button
                  className="tab-close-btn"
                  onClick={(e) => { e.stopPropagation(); closeScriptView(view.id); }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="script-view-controls">
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => setViewMode(viewMode === 'split' ? 'tabs' : 'split')}
              title={viewMode === 'split' ? 'Switch to tabs' : 'Switch to split view'}
            >
              {viewMode === 'split' ? '📑' : '🔀'}
            </button>
            {runningCount > 0 && (
              <button
                className="btn btn-danger btn-xs"
                onClick={stopAllScripts}
                title={`Stop all running scripts (${runningCount})`}
              >
                ⏹️ Stop All ({runningCount})
              </button>
            )}
          </div>
        </div>

        {viewMode === 'split' ? (
          <div className="script-view-split">
            {scriptViews.filter(view => !view.isMinimized).map(view => (
              <div key={view.id} className="script-view-panel">
                {renderScriptOutput(view.scriptId, view.scriptName, view.activeTab)}
              </div>
            ))}
          </div>
        ) : (
          activeView && !activeView.isMinimized && (
            <div className="script-view-content">
              {renderScriptOutput(activeView.scriptId, activeView.scriptName, activeView.activeTab)}
            </div>
          )
        )}
      </div>
    );
  };

  // Render script output for a specific script
  const renderScriptOutput = (scriptId: string, scriptName: string, activeTab: 'current' | 'history') => {
    const output = scriptOutput[scriptId];
    const isRunning = isScriptRunning(scriptId);

    return (
      <div className="script-output-panel">
        <div className="script-output-header">
          <div className="script-output-title">
            <TerminalIcon size={16} />
            <span>{scriptName}</span>
            {isRunning && <span className="status-indicator running">Running</span>}
          </div>
          <div className="script-output-actions">
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'current' ? 'active' : ''}`}
                onClick={() => {
                  setScriptViews(prev => prev.map(view =>
                    view.scriptId === scriptId ? { ...view, activeTab: 'current' } : view
                  ));
                }}
              >
                Current
              </button>
              <button
                className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => {
                  setScriptViews(prev => prev.map(view =>
                    view.scriptId === scriptId ? { ...view, activeTab: 'history' } : view
                  ));
                }}
              >
                History
              </button>
            </div>
            {output && (
              <button
                className="btn btn-secondary btn-xs"
                onClick={() => clearScriptOutput(`${project.id}:${scriptId}`)}
                title="Clear output"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="script-output-content">
          {activeTab === 'current' ? (
            <ColorCodedOutput
              content={output?.output || 'No output yet...'}
              className="script-output-content"
            />
          ) : (
            <div className="execution-history">
              {executionHistory
                .filter(entry => entry.scriptId === scriptId)
                .map(entry => (
                  <div key={entry.id} className="history-entry">
                    <div className="history-entry-header">
                      <span className="history-timestamp">{formatTimestamp(entry.startTime)}</span>
                      <span
                        className="history-status"
                        style={{ color: getStatusColor(entry.status, entry.exitCode) }}
                      >
                        {entry.status} {entry.exitCode !== undefined ? `(${entry.exitCode})` : ''}
                      </span>
                      <span className="history-duration">{entry.duration !== undefined ? formatDuration(entry.duration) : 'N/A'}</span>
                    </div>
                    <ColorCodedOutput content={entry.output} className="script-output-content" />
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="action-section">
      <div className="section-header-with-actions">
        <h2 className="section-title">Scripts</h2>
        <div className="script-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => refreshAutoScripts(project.id)}
            title="Refresh auto-detected scripts"
          >
            🔄 Refresh Auto-Scripts
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            <PlusIcon size={14} />
            Add Script
          </button>
        </div>
      </div>      {project.scripts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <SettingsIcon size={48} color="var(--vscode-secondary-foreground)" />
          </div>
          <div className="empty-state-title">No Scripts Defined</div>
          <div className="empty-state-description">
            Add custom scripts to run common development tasks, or let the app auto-detect scripts from your project.
          </div>
          <div className="empty-state-actions">
            <button
              className="btn btn-secondary"
              onClick={() => refreshAutoScripts(project.id)}
            >
              🔄 Detect Scripts
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <PlusIcon size={14} />
              Add Manual Script
            </button>
          </div>
        </div>
      ) : (
        <div className="scripts-container">
          {/* Auto-detected scripts */}
          {project.scripts.filter(script => script.isAutoDetected).length > 0 && (
            <div className="scripts-section">
              <h3 className="scripts-section-title">
                🤖 Auto-detected Scripts
                <span className="scripts-count">
                  ({project.scripts.filter(script => script.isAutoDetected).length})
                </span>
              </h3>
              <div className="scripts-list">
                {project.scripts
                  .filter(script => script.isAutoDetected)
                  .map((script) => {
                    const isRunning = isScriptRunning(script.id);
                    const output = scriptOutput[script.id];

                    return (
                      <div key={script.id} className="script-item auto-detected">
                        <div className="script-header">
                          <div className="script-info">
                            <div className="script-name">
                              <span className="auto-detected-badge">AUTO</span>
                              {script.name}
                              {script.projectType && (
                                <span className="project-type-badge">{script.projectType}</span>
                              )}
                            </div>
                            <div className="script-command">{script.command}</div>
                          </div>
                          <div className="script-actions">
                            <button
                              className={`btn ${isRunning ? 'btn-danger' : 'btn-success'} btn-sm`}
                              onClick={() => handleScriptAction(script)}
                              title={isRunning ? 'Stop script' : 'Run script'}
                            >
                              {isRunning ? (
                                <>
                                  <CloseIcon size={14} />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <PlayIcon size={14} />
                                  Run
                                </>
                              )}
                            </button>
                            {output && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => toggleScriptOutput(script.id)}
                                title={output.isVisible ? 'Hide output' : 'Show output'}
                              >
                                <TerminalIcon size={14} />
                                {output.isVisible ? (
                                  <ChevronUpIcon size={14} />
                                ) : (
                                  <ChevronDownIcon size={14} />
                                )}
                              </button>
                            )}
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleScriptClick(script)}
                              title="Open in tab"
                            >
                              📑
                            </button>
                          </div>
                        </div>
                        {output?.isVisible && (
                          <div className="script-output">
                            <div className="script-output-header">
                              <div className="output-tabs">
                                <button
                                  className={`output-tab ${activeOutputTab === 'current' ? 'active' : ''}`}
                                  onClick={() => setActiveOutputTab('current')}
                                >
                                  Current Output
                                </button>
                                <button
                                  className={`output-tab ${activeOutputTab === 'history' ? 'active' : ''}`}
                                  onClick={() => setActiveOutputTab('history')}
                                >
                                  History
                                </button>
                              </div>
                              <div className="output-actions">
                                {activeOutputTab === 'current' ? (
                                  <button
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => clearScriptOutput(script.id)}
                                    title="Clear output"
                                  >
                                    Clear
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-secondary btn-xs"
                                    onClick={clearExecutionHistory}
                                    title="Clear execution history"
                                  >
                                    <TrashIcon size={12} />
                                    Clear History
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="script-output-content">
                              {activeOutputTab === 'current' ? (
                                <ColorCodedOutput
                                  content={output.output || 'No output yet...'}
                                  className="script-output-content"
                                />
                              ) : (
                                <div className="execution-history">
                                  <div className="history-filters">
                                    <div className="search-box">
                                      <SearchIcon size={14} />
                                      <input
                                        type="text"
                                        placeholder="Search history..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="search-input"
                                      />
                                    </div>
                                  </div>
                                  <div className="history-list">
                                    {filteredHistory.length === 0 ? (
                                      <div className="history-empty">No execution history found</div>
                                    ) : (
                                      filteredHistory.map((entry) => (
                                        <div key={entry.id} className={`history-entry ${entry.status}`}>
                                          <div className="history-entry-header">
                                            <div className="history-entry-info">
                                              <span className="history-script-name">{entry.scriptName}</span>
                                              <span className={`history-status status-${entry.status}`}>
                                                {entry.status.toUpperCase()}
                                              </span>
                                              {entry.duration && (
                                                <span className="history-duration">
                                                  {formatDuration(entry.duration)}
                                                </span>
                                              )}
                                            </div>
                                            <div className="history-entry-time">
                                              {new Date(entry.startTime).toLocaleString()}
                                            </div>
                                          </div>
                                          <div className="history-entry-command">
                                            {entry.command}
                                          </div>
                                          {entry.output && (
                                            <div className="history-entry-output">
                                              <ColorCodedOutput
                                                content={entry.output}
                                                className="history-output"
                                              />
                                            </div>
                                          )}
                                          {entry.error && (
                                            <div className="history-entry-error">
                                              <strong>Error:</strong> {entry.error}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Manual scripts */}
          {project.scripts.filter(script => !script.isAutoDetected).length > 0 && (
            <div className="scripts-section">
              <h3 className="scripts-section-title">
                ⚙️ Custom Scripts
                <span className="scripts-count">
                  ({project.scripts.filter(script => !script.isAutoDetected).length})
                </span>
              </h3>
              <div className="scripts-list">
                {project.scripts
                  .filter(script => !script.isAutoDetected)
                  .map((script) => {
                    const isRunning = isScriptRunning(script.id);
                    const output = scriptOutput[script.id];

                    return (
                      <div key={script.id} className="script-item">
                        <div className="script-header">
                          <div className="script-info">
                            <div className="script-name">{script.name}</div>
                            <div className="script-command">{script.command}</div>
                          </div>
                          <div className="script-actions">
                            <button
                              className={`btn ${isRunning ? 'btn-danger' : 'btn-success'} btn-sm`}
                              onClick={() => handleScriptAction(script)}
                              title={isRunning ? 'Stop script' : 'Run script'}
                            >
                              {isRunning ? (
                                <>
                                  <CloseIcon size={14} />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <PlayIcon size={14} />
                                  Run
                                </>
                              )}
                            </button>
                            {output && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => toggleScriptOutput(script.id)}
                                title={output.isVisible ? 'Hide output' : 'Show output'}
                              >
                                <TerminalIcon size={14} />
                                {output.isVisible ? (
                                  <ChevronUpIcon size={14} />
                                ) : (
                                  <ChevronDownIcon size={14} />
                                )}
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleEditScript(script)}
                              title="Edit script"
                            >
                              <EditIcon size={14} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete the script "${script.name}"?`)) {
                                  onRemoveScript(script.id);
                                }
                              }}
                              title="Delete script"
                            >
                              <CloseIcon size={14} />
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleScriptClick(script)}
                              title="Open in tab"
                            >
                              📑
                            </button>
                          </div>
                        </div>
                        {output?.isVisible && (
                          <div className="script-output">
                            <div className="script-output-header">
                              <div className="output-tabs">
                                <button
                                  className={`output-tab ${activeOutputTab === 'current' ? 'active' : ''}`}
                                  onClick={() => setActiveOutputTab('current')}
                                >
                                  Current Output
                                </button>
                                <button
                                  className={`output-tab ${activeOutputTab === 'history' ? 'active' : ''}`}
                                  onClick={() => setActiveOutputTab('history')}
                                >
                                  History
                                </button>
                              </div>
                              <div className="output-actions">
                                {activeOutputTab === 'current' ? (
                                  <button
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => clearScriptOutput(script.id)}
                                    title="Clear output"
                                  >
                                    Clear
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-secondary btn-xs"
                                    onClick={clearExecutionHistory}
                                    title="Clear execution history"
                                  >
                                    <TrashIcon size={12} />
                                    Clear History
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="script-output-content">
                              {activeOutputTab === 'current' ? (
                                <ColorCodedOutput
                                  content={output.output || 'No output yet...'}
                                  className="script-output-content"
                                />
                              ) : (
                                <div className="execution-history">
                                  <div className="history-filters">
                                    <div className="search-box">
                                      <SearchIcon size={14} />
                                      <input
                                        type="text"
                                        placeholder="Search history..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="search-input"
                                      />
                                    </div>
                                  </div>
                                  <div className="history-list">
                                    {filteredHistory.length === 0 ? (
                                      <div className="history-empty">No execution history found</div>
                                    ) : (
                                      filteredHistory.map((entry) => (
                                        <div key={entry.id} className={`history-entry ${entry.status}`}>
                                          <div className="history-entry-header">
                                            <div className="history-entry-info">
                                              <span className="history-script-name">{entry.scriptName}</span>
                                              <span className={`history-status status-${entry.status}`}>
                                                {entry.status.toUpperCase()}
                                              </span>
                                              {entry.duration && (
                                                <span className="history-duration">
                                                  {formatDuration(entry.duration)}
                                                </span>
                                              )}
                                            </div>
                                            <div className="history-entry-time">
                                              {new Date(entry.startTime).toLocaleString()}
                                            </div>
                                          </div>
                                          <div className="history-entry-command">
                                            {entry.command}
                                          </div>
                                          {entry.output && (
                                            <div className="history-entry-output">
                                              <ColorCodedOutput
                                                content={entry.output}
                                                className="history-output"
                                              />
                                            </div>
                                          )}
                                          {entry.error && (
                                            <div className="history-entry-error">
                                              <strong>Error:</strong> {entry.error}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabbed Script View */}
      {renderTabbedScriptView()}

      {/* Add/Edit Script Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingScript ? 'Edit Script' : 'Add New Script'}
              </h3>
              <button
                className="modal-close"
                onClick={handleCloseModal}
                title="Close"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label className="form-label" htmlFor="scriptName">
                  Script Name
                </label>
                <input
                  type="text"
                  id="scriptName"
                  className="form-input"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="e.g., Start Dev Server, Run Tests"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="scriptCommand">
                  Command
                </label>
                <input
                  type="text"
                  id="scriptCommand"
                  className="form-input"
                  value={scriptCommand}
                  onChange={(e) => setScriptCommand(e.target.value)}
                  placeholder="e.g., npm run dev, yarn test, python manage.py runserver"
                />
                <div className="form-help">
                  This command will be executed in the project's root directory.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={editingScript ? handleUpdateScript : handleAddScript}
                disabled={!scriptName.trim() || !scriptCommand.trim()}
              >
                {editingScript ? 'Update Script' : 'Add Script'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptsTab;
