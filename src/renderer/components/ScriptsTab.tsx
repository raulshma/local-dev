import React, { useState } from 'react';
import { Project, ProjectScript } from '../../types';
import { useApp } from '../contexts/AppContext';
import { 
  PlusIcon, 
  PlayIcon, 
  CloseIcon, 
  SettingsIcon,
  EditIcon,
  TerminalIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from './Icons';

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
  const { runningScripts, scriptOutput, clearScriptOutput, toggleScriptOutput } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingScript, setEditingScript] = useState<ProjectScript | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptCommand, setScriptCommand] = useState('');

  const isScriptRunning = (scriptId: string) => {
    return runningScripts.has(`${project.id}:${scriptId}`);
  };

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

  return (
    <div className="action-section">
      <div className="section-header-with-actions">
        <h2 className="section-title">Scripts</h2>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
        >
          <PlusIcon size={14} />
          Add Script
        </button>
      </div>

      {project.scripts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <SettingsIcon size={48} color="var(--vscode-secondary-foreground)" />
          </div>
          <div className="empty-state-title">No Scripts Defined</div>
          <div className="empty-state-description">
            Add custom scripts to run common development tasks like starting servers, running tests, or building your project.
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowAddModal(true)}
          >
            <PlusIcon size={14} />
            Add Your First Script
          </button>
        </div>
      ) : (
        <div className="scripts-list">
          {project.scripts.map((script) => {
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
                  </div>
                </div>
                {output?.isVisible && (
                  <div className="script-output">
                    <div className="script-output-header">
                      <span>Output</span>
                      <button
                        className="btn btn-secondary btn-xs"
                        onClick={() => clearScriptOutput(script.id)}
                        title="Clear output"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="script-output-content">
                      <pre>{output.output || 'No output yet...'}</pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
