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
import './ScriptsTab.css';

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
  const { runningScripts, stoppingScripts, scriptOutput, clearScriptOutput, toggleScriptOutput, refreshAutoScripts } = useApp();
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

  const isScriptStopping = (scriptId: string) => {
    return stoppingScripts.has(`${project.id}:${scriptId}`);
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
                <div className="tab-content">
                  <TerminalIcon size={14} />
                  <span className="tab-name">{view.scriptName}</span>
                  {isScriptRunning(view.scriptId) && (
                    <div className="tab-status running">
                      <div className="status-indicator"></div>
                    </div>
                  )}
                </div>
                <div className="tab-actions">
                  <button
                    className="btn btn-ghost btn-xs tab-action-btn"
                    onClick={(e) => { e.stopPropagation(); togglePinView(view.id); }}
                    title={view.isPinned ? 'Unpin' : 'Pin'}
                  >
                    {view.isPinned ? '📌' : '📍'}
                  </button>
                  <button
                    className="btn btn-ghost btn-xs tab-action-btn"
                    onClick={(e) => { e.stopPropagation(); toggleMinimizeView(view.id); }}
                    title={view.isMinimized ? 'Restore' : 'Minimize'}
                  >
                    {view.isMinimized ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
                  </button>
                  <button
                    className="btn btn-ghost btn-xs tab-action-btn"
                    onClick={(e) => { e.stopPropagation(); closeScriptView(view.id); }}
                    title="Close"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="script-view-controls">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setViewMode(viewMode === 'split' ? 'tabs' : 'split')}
              title={viewMode === 'split' ? 'Switch to tabs' : 'Switch to split view'}
            >
              {viewMode === 'split' ? '📑' : '🔀'} {viewMode === 'split' ? 'Tabs' : 'Split'}
            </button>
            {runningCount > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={stopAllScripts}
                title={`Stop all running scripts (${runningCount})`}
              >
                <CloseIcon size={14} />
                Stop All ({runningCount})
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
      <div className="dedicated-script-output">
        <div className="dedicated-output-header">
          <div className="dedicated-output-title">
            <TerminalIcon size={16} />
            <span className="output-script-name">{scriptName}</span>
            {isRunning && (
              <div className="script-status running">
                <div className="status-indicator"></div>
                <span>Running</span>
              </div>
            )}
          </div>
          <div className="dedicated-output-actions">
            <div className="output-tabs">
              <button
                className={`output-tab ${activeTab === 'current' ? 'active' : ''}`}
                onClick={() => {
                  setScriptViews(prev => prev.map(view =>
                    view.scriptId === scriptId ? { ...view, activeTab: 'current' } : view
                  ));
                }}
              >
                <TerminalIcon size={14} />
                Current
              </button>
              <button
                className={`output-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => {
                  setScriptViews(prev => prev.map(view =>
                    view.scriptId === scriptId ? { ...view, activeTab: 'history' } : view
                  ));
                }}
              >
                📋 History
              </button>
            </div>
            {output && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => clearScriptOutput(`${project.id}:${scriptId}`)}
                title="Clear output"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="dedicated-output-content">
          {activeTab === 'current' ? (
            <ColorCodedOutput
              content={output?.output || 'No output yet...'}
              className="output-viewer"
            />
          ) : (
            <div className="execution-history">
              <div className="history-search">
                <div className="search-input-container">
                  <SearchIcon size={14} />
                  <input
                    type="text"
                    placeholder="Search execution history..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="history-search-input"
                  />
                </div>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={clearExecutionHistory}
                  title="Clear all history"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
              <div className="history-entries">
                {executionHistory
                  .filter(entry => entry.scriptId === scriptId)
                  .filter(entry => {
                    if (!historySearch.trim()) return true;
                    const searchLower = historySearch.toLowerCase();
                    return (
                      entry.scriptName.toLowerCase().includes(searchLower) ||
                      entry.command.toLowerCase().includes(searchLower) ||
                      entry.output.toLowerCase().includes(searchLower)
                    );
                  })
                  .map(entry => (
                    <div key={entry.id} className={`history-entry status-${entry.status}`}>
                      <div className="history-entry-header">
                        <div className="history-meta">
                          <span
                            className={`history-status ${entry.status}`}
                            style={{ color: getStatusColor(entry.status, entry.exitCode) }}
                          >
                            {entry.status} {entry.exitCode !== undefined ? `(${entry.exitCode})` : ''}
                          </span>
                          <span className="history-time">{formatTimestamp(entry.startTime)}</span>
                          {entry.duration !== undefined && (
                            <span className="history-duration">{formatDuration(entry.duration)}</span>
                          )}
                        </div>
                      </div>
                      <div className="history-command">
                        <code>{entry.command}</code>
                      </div>
                      {entry.output && (
                        <div className="history-output">
                          <ColorCodedOutput content={entry.output} className="output-viewer compact" />
                        </div>
                      )}
                      {entry.error && (
                        <div className="history-error">
                          <span className="error-label">Error:</span>
                          <span className="error-message">{entry.error}</span>
                        </div>
                      )}
                    </div>
                  ))}
                {executionHistory.filter(entry => entry.scriptId === scriptId).length === 0 && (
                  <div className="history-empty">
                    <TerminalIcon size={24} color="var(--vscode-secondary-foreground)" />
                    <span>No execution history</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render individual script card
  const renderScriptCard = (script: ProjectScript, isAutoDetected: boolean) => {
    const isRunning = isScriptRunning(script.id);
    const isStopping = isScriptStopping(script.id);
    const output = scriptOutput[script.id];

    return (
      <div key={script.id} className={`script-card ${isAutoDetected ? 'auto-detected' : 'custom'}`}>
        <div className="script-card-header">
          <div className="script-card-info">
            <div className="script-card-title">
              <span className="script-name">{script.name}</span>
              {isAutoDetected && (
                <span className="script-badge auto">Auto</span>
              )}
              {script.projectType && (
                <span className="script-badge type">{script.projectType}</span>
              )}
              {isRunning && !isStopping && (
                <div className="script-status running">
                  <div className="status-indicator"></div>
                  <span>Running</span>
                </div>
              )}
              {isStopping && (
                <div className="script-status stopping">
                  <div className="status-indicator stopping"></div>
                  <span>Stopping...</span>
                </div>
              )}
            </div>
            <div className="script-command">
              <code>{script.command}</code>
            </div>
          </div>
          <div className="script-card-actions">
            <button
              className={`btn btn-icon ${isRunning || isStopping ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => handleScriptAction(script)}
              disabled={isStopping}
              title={isStopping ? 'Stopping...' : isRunning ? 'Stop script' : 'Run script'}
            >
              {isStopping ? (
                <div className="spinner-small"></div>
              ) : isRunning ? (
                <CloseIcon size={16} />
              ) : (
                <PlayIcon size={16} />
              )}
            </button>
            {output && (
              <button
                className="btn btn-icon btn-secondary"
                onClick={() => toggleScriptOutput(script.id)}
                title={output.isVisible ? 'Hide output' : 'Show output'}
              >
                <TerminalIcon size={16} />
              </button>
            )}
            {!isAutoDetected && (
              <>
                <button
                  className="btn btn-icon btn-ghost"
                  onClick={() => handleEditScript(script)}
                  title="Edit script"
                >
                  <EditIcon size={16} />
                </button>
                <button
                  className="btn btn-icon btn-ghost"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete "${script.name}"?`)) {
                      onRemoveScript(script.id);
                    }
                  }}
                  title="Delete script"
                >
                  <TrashIcon size={16} />
                </button>
              </>
            )}
            <button
              className="btn btn-icon btn-ghost"
              onClick={() => handleScriptClick(script)}
              title="Open in dedicated view"
            >
              <ChevronDownIcon size={16} />
            </button>
          </div>
        </div>

        {output?.isVisible && (
          <div className="script-output-panel">
            <div className="script-output-tabs">
              <button
                className={`output-tab ${activeOutputTab === 'current' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('current')}
              >
                <TerminalIcon size={14} />
                Output
              </button>
              <button
                className={`output-tab ${activeOutputTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('history')}
              >
                📋 History
              </button>
              <div className="output-tab-actions">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => clearScriptOutput(script.id)}
                  title="Clear current output"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="script-output-content">
              {activeOutputTab === 'current' ? (
                <ColorCodedOutput
                  content={output.output || 'No output yet...'}
                  className="output-viewer"
                />
              ) : (
                <div className="execution-history">
                  <div className="history-search">
                    <div className="search-input-container">
                      <SearchIcon size={14} />
                      <input
                        type="text"
                        placeholder="Search execution history..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="history-search-input"
                      />
                    </div>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={clearExecutionHistory}
                      title="Clear all history"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                  <div className="history-entries">
                    {filteredHistory
                      .filter(entry => entry.scriptId === script.id)
                      .map((entry) => (
                        <div key={entry.id} className={`history-entry status-${entry.status}`}>
                          <div className="history-entry-header">
                            <div className="history-meta">
                              <span className={`history-status ${entry.status}`}>
                                {entry.status}
                              </span>
                              <span className="history-time">
                                {formatTimestamp(entry.startTime)}
                              </span>
                              {entry.duration && (
                                <span className="history-duration">
                                  {formatDuration(entry.duration)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="history-command">
                            <code>{entry.command}</code>
                          </div>
                          {entry.output && (
                            <div className="history-output">
                              <ColorCodedOutput
                                content={entry.output}
                                className="output-viewer compact"
                              />
                            </div>
                          )}
                          {entry.error && (
                            <div className="history-error">
                              <span className="error-label">Error:</span>
                              <span className="error-message">{entry.error}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    {filteredHistory.filter(entry => entry.scriptId === script.id).length === 0 && (
                      <div className="history-empty">
                        <TerminalIcon size={24} color="var(--vscode-secondary-foreground)" />
                        <span>No execution history</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="scripts-tab">
      <div className="scripts-header">
        <div className="scripts-header-content">
          <div className="scripts-title-group">
            <TerminalIcon size={16} />
            <h2 className="scripts-title">Scripts</h2>
            <div className="scripts-badge">
              {project.scripts.length}
            </div>
          </div>
          <div className="scripts-toolbar">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => refreshAutoScripts(project.id)}
              title="Refresh auto-detected scripts"
            >
              <SearchIcon size={14} />
              Auto-detect
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddModal(true)}
              title="Add custom script"
            >
              <PlusIcon size={14} />
              Add Script
            </button>
          </div>
        </div>
      </div>      <div className="scripts-body">
        {project.scripts.length === 0 ? (
          <div className="scripts-empty-state">
            <div className="empty-state-icon">
              <TerminalIcon size={64} color="var(--vscode-secondary-foreground)" />
            </div>
            <div className="empty-state-content">
              <h3 className="empty-state-title">No Scripts Found</h3>
              <p className="empty-state-description">
                Get started by adding custom scripts or let us detect them automatically from your project files.
              </p>
              <div className="empty-state-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  <PlusIcon size={16} />
                  Add Script
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => refreshAutoScripts(project.id)}
                >
                  <SearchIcon size={16} />
                  Auto-detect Scripts
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="scripts-list-container">
            {/* Auto-detected scripts */}
            {project.scripts.filter(script => script.isAutoDetected).length > 0 && (
              <div className="scripts-group">
                <div className="scripts-group-header">
                  <div className="scripts-group-title">
                    <div className="scripts-group-icon auto-detected">
                      <SearchIcon size={14} />
                    </div>
                    <span>Auto-detected Scripts</span>
                    <span className="scripts-group-count">
                      {project.scripts.filter(script => script.isAutoDetected).length}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => refreshAutoScripts(project.id)}
                    title="Refresh auto-detected scripts"
                  >
                    <SearchIcon size={12} />
                  </button>
                </div>
                <div className="scripts-grid">
                  {project.scripts
                    .filter(script => script.isAutoDetected)
                    .map((script) => renderScriptCard(script, true))}
                </div>
              </div>
            )}

            {/* Custom scripts */}
            {project.scripts.filter(script => !script.isAutoDetected).length > 0 && (
              <div className="scripts-group">
                <div className="scripts-group-header">
                  <div className="scripts-group-title">
                    <div className="scripts-group-icon custom">
                      <SettingsIcon size={14} />
                    </div>
                    <span>Custom Scripts</span>
                    <span className="scripts-group-count">
                      {project.scripts.filter(script => !script.isAutoDetected).length}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => setShowAddModal(true)}
                    title="Add custom script"
                  >
                    <PlusIcon size={12} />
                  </button>
                </div>
                <div className="scripts-grid">
                  {project.scripts
                    .filter(script => !script.isAutoDetected)
                    .map((script) => renderScriptCard(script, false))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabbed Script View */}
      {renderTabbedScriptView()}

      {/* Add/Edit Script Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="script-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <TerminalIcon size={16} />
                <h3 className="modal-title">
                  {editingScript ? 'Edit Script' : 'Add New Script'}
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-icon"
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
                className="btn btn-ghost"
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
