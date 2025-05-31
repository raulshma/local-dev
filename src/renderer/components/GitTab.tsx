import React, { useState, useEffect } from 'react';
import { GitStatus, GitBranch, GitCommit, GitChangedFile, GitStash } from '../../types';
import { useApp } from '../contexts/AppContext';

interface GitTabProps {
  projectId: string;
}

const GitTab: React.FC<GitTabProps> = ({ projectId }) => {
  const { openFolder } = useApp();
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [recentCommits, setRecentCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  // New state for diff and stash management
  const [changedFiles, setChangedFiles] = useState<GitChangedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string>('');
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  // Load Git data
  const loadGitData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if it's a Git repository
      const repoResult = await window.electron.git.checkRepository(projectId);
      if (!repoResult.success || !repoResult.isRepository) {
        setGitStatus({
          isRepository: false,
          ahead: 0,
          behind: 0,
          staged: 0,
          unstaged: 0,
          untracked: 0,
          clean: true,
          hasUncommittedChanges: false,
        });
        return;
      }

      // Load Git status
      const statusResult = await window.electron.git.getStatus(projectId);
      if (statusResult.success && statusResult.status) {
        setGitStatus(statusResult.status);
      }

      // Load branches
      const branchesResult = await window.electron.git.getBranches(projectId);
      if (branchesResult.success && branchesResult.branches) {
        setBranches(branchesResult.branches);
      }      // Load recent commits
      const commitsResult = await window.electron.git.getRecentCommits(projectId, 5);
      if (commitsResult.success && commitsResult.commits) {
        setRecentCommits(commitsResult.commits);
      }

      // Load changed files
      const filesResult = await window.electron.git.getChangedFiles(projectId);
      if (filesResult.success && filesResult.files) {
        setChangedFiles(filesResult.files);
      }

      // Load stashes
      const stashesResult = await window.electron.git.getStashes(projectId);
      if (stashesResult.success && stashesResult.stashes) {
        setStashes(stashesResult.stashes);
      }

    } catch (err) {
      console.error('Error loading Git data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGitData();
  }, [projectId]);

  const handleRefresh = () => {
    loadGitData();
  };

  const handleBranchSwitch = async (branchName: string) => {
    try {
      const result = await window.electron.git.switchBranch(projectId, branchName);
      if (result.success) {
        await loadGitData(); // Reload data after switch
      } else {
        setError(result.error || 'Failed to switch branch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handlePull = async () => {
    try {
      const result = await window.electron.git.pull(projectId);
      if (result.success && result.result?.success) {
        await loadGitData(); // Reload data after pull
      } else {
        setError(result.result?.error || result.error || 'Failed to pull changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handlePush = async () => {
    try {
      const result = await window.electron.git.push(projectId);
      if (result.success && result.result?.success) {
        await loadGitData(); // Reload data after push
      } else {
        setError(result.result?.error || result.error || 'Failed to push changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Please enter a commit message');
      return;
    }

    try {
      // First stage all changes
      const stageResult = await window.electron.git.stageFiles(projectId, []);
      if (!stageResult.success) {
        setError(stageResult.error || 'Failed to stage files');
        return;
      }

      // Then commit
      const result = await window.electron.git.commit(projectId, commitMessage.trim());
      if (result.success) {
        setCommitMessage('');
        setShowCommitDialog(false);
        await loadGitData(); // Reload data after commit
      } else {
        setError(result.error || 'Failed to commit changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };  const handleOpenInGitClient = async () => {
    try {
      // For now, just open the project folder
      // Future enhancement: integrate with actual Git clients
      await openFolder(projectId);
    } catch (err) {
      setError('Failed to open project folder');
    }
  };

  // Diff viewer handlers
  const handleShowDiff = async (filePath?: string) => {
    try {
      const result = await window.electron.git.getDiff(projectId, filePath);
      if (result.success) {
        setFileDiff(result.diff || '');
        setSelectedFile(filePath || null);
        setShowDiffViewer(true);
      } else {
        setError(result.error || 'Failed to get diff');
      }
    } catch (err) {
      setError('Failed to get diff');
    }
  };

  // Stash handlers
  const handleCreateStash = async () => {
    try {
      const result = await window.electron.git.createStash(projectId, stashMessage || undefined);
      if (result.success) {
        setStashMessage('');
        setShowStashDialog(false);
        await loadGitData(); // Reload to refresh stash list and status
      } else {
        setError(result.error || 'Failed to create stash');
      }
    } catch (err) {
      setError('Failed to create stash');
    }
  };

  const handleApplyStash = async (stashIndex: number) => {
    try {
      const result = await window.electron.git.applyStash(projectId, stashIndex);
      if (result.success) {
        await loadGitData(); // Reload to refresh status
      } else {
        setError(result.error || 'Failed to apply stash');
      }
    } catch (err) {
      setError('Failed to apply stash');
    }
  };

  const handleDropStash = async (stashIndex: number) => {
    try {
      const result = await window.electron.git.dropStash(projectId, stashIndex);
      if (result.success) {
        await loadGitData(); // Reload to refresh stash list
      } else {
        setError(result.error || 'Failed to drop stash');
      }
    } catch (err) {
      setError('Failed to drop stash');
    }
  };

  const handlePopStash = async () => {
    try {
      const result = await window.electron.git.popStash(projectId);
      if (result.success) {
        await loadGitData(); // Reload to refresh status and stash list
      } else {
        setError(result.error || 'Failed to pop stash');
      }
    } catch (err) {
      setError('Failed to pop stash');
    }
  };

  if (isLoading) {
    return (
      <div className="git-tab vscode-tab">
        <div className="vscode-loading">
          <div className="vscode-spinner">
            <svg className="loading-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="50" strokeDashoffset="25">
                <animateTransform attributeName="transform" type="rotate" dur="1s" repeatCount="indefinite" values="0 12 12;360 12 12"/>
              </circle>
            </svg>
          </div>
          <span className="loading-text">Loading Git information...</span>
        </div>
      </div>
    );
  }

  if (!gitStatus?.isRepository) {
    return (
      <div className="git-tab vscode-tab">
        <div className="vscode-empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6"/>
              <path d="m9 9 6 6"/>
            </svg>
          </div>
          <h3 className="empty-title">Not a Git Repository</h3>
          <p className="empty-description">This project is not a Git repository or Git is not available.</p>
          <button className="vscode-button vscode-button-secondary" onClick={handleRefresh}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="git-tab vscode-tab">
      {error && (
        <div className="vscode-error-banner">
          <svg className="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17 .01 0"/>
          </svg>
          <span className="error-text">{error}</span>
          <button className="vscode-button-icon error-close" onClick={() => setError(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* Git Status Section */}
      <div className="vscode-section">
        <div className="section-header">
          <h3 className="section-title">
            <svg className="section-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6"/>
              <path d="m21 12-6-6-6 6-6-6"/>
            </svg>
            Repository Status
          </h3>
          <button className="vscode-button-icon" onClick={handleRefresh} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          </button>
        </div>

        <div className="vscode-grid">
          <div className="vscode-status-card">
            <div className="status-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              <span className="status-label">Current Branch</span>
            </div>
            <div className="status-value current-branch">
              {gitStatus.currentBranch || 'Unknown'}
            </div>
          </div>

          <div className="vscode-status-card">
            <div className="status-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              <span className="status-label">Working Tree</span>
            </div>
            <div className="status-value">
              {gitStatus.hasUncommittedChanges ? (
                <div className="changes-summary">
                  {gitStatus.staged > 0 && (
                    <span className="change-badge staged">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {gitStatus.staged}
                    </span>
                  )}
                  {gitStatus.unstaged > 0 && (
                    <span className="change-badge modified">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="1"/>
                      </svg>
                      {gitStatus.unstaged}
                    </span>
                  )}
                  {gitStatus.untracked > 0 && (
                    <span className="change-badge untracked">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      {gitStatus.untracked}
                    </span>
                  )}
                </div>
              ) : (
                <span className="status-clean">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Clean
                </span>
              )}
            </div>
          </div>

          <div className="vscode-status-card">
            <div className="status-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
              <span className="status-label">Remote</span>
            </div>
            <div className="status-value">
              <div className="remote-status">
                {gitStatus.ahead > 0 && (
                  <span className="remote-badge ahead">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15"/>
                    </svg>
                    {gitStatus.ahead}
                  </span>
                )}
                {gitStatus.behind > 0 && (
                  <span className="remote-badge behind">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    {gitStatus.behind}
                  </span>
                )}
                {gitStatus.ahead === 0 && gitStatus.behind === 0 && (
                  <span className="remote-badge synced">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Synced
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="vscode-section">
        <div className="section-header">
          <h3 className="section-title">
            <svg className="section-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Quick Actions
          </h3>
        </div>

        <div className="vscode-action-grid">
          <button
            className={`vscode-action-button ${gitStatus.behind === 0 ? 'disabled' : ''}`}
            onClick={handlePull}
            disabled={gitStatus.behind === 0}
            title={gitStatus.behind > 0 ? `Pull ${gitStatus.behind} commit(s)` : 'No changes to pull'}
          >
            <svg className="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="8 18 12 22 16 18"/>
              <polyline points="12 2 12 22"/>
            </svg>
            <span>Pull{gitStatus.behind > 0 && ` (${gitStatus.behind})`}</span>
          </button>

          <button
            className={`vscode-action-button ${gitStatus.ahead === 0 ? 'disabled' : ''}`}
            onClick={handlePush}
            disabled={gitStatus.ahead === 0}
            title={gitStatus.ahead > 0 ? `Push ${gitStatus.ahead} commit(s)` : 'No changes to push'}
          >
            <svg className="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 6 12 2 8 6"/>
              <polyline points="12 2 12 22"/>
            </svg>
            <span>Push{gitStatus.ahead > 0 && ` (${gitStatus.ahead})`}</span>
          </button>

          <button
            className={`vscode-action-button primary ${!gitStatus.hasUncommittedChanges ? 'disabled' : ''}`}
            onClick={() => setShowCommitDialog(true)}
            disabled={!gitStatus.hasUncommittedChanges}
            title={gitStatus.hasUncommittedChanges ? 'Create a new commit' : 'No changes to commit'}
          >
            <svg className="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Commit</span>
          </button>

          <button
            className={`vscode-action-button ${!gitStatus.hasUncommittedChanges ? 'disabled' : ''}`}
            onClick={() => setShowStashDialog(true)}
            disabled={!gitStatus.hasUncommittedChanges}
            title={gitStatus.hasUncommittedChanges ? 'Stash current changes' : 'No changes to stash'}
          >
            <svg className="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="m7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Stash</span>
          </button>

          <button
            className={`vscode-action-button ${stashes.length === 0 ? 'disabled' : ''}`}
            onClick={handlePopStash}
            disabled={stashes.length === 0}
            title={stashes.length > 0 ? 'Pop latest stash' : 'No stashes available'}
          >
            <svg className="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 1 1 10 0v4M8 21l4-4 4 4"/>
            </svg>
            <span>Pop Stash</span>
          </button>

          <button
            className="vscode-action-button"
            onClick={handleOpenInGitClient}
            title="Open project in Git client"
          >
            <svg className="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            <span>Open Folder</span>
          </button>
        </div>
      </div>

      {/* Branches Section */}
      {branches.length > 0 && (
        <div className="vscode-section">
          <div className="section-header">
            <h3 className="section-title">
              <svg className="section-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Branches
            </h3>
            <span className="section-count">{branches.length}</span>
          </div>
          <div className="vscode-list">
            {branches.slice(0, 10).map((branch) => (
              <div
                key={branch.name}
                className={`vscode-list-item ${branch.isCurrent ? 'current-branch' : ''}`}
              >
                <div className="list-item-content">
                  <div className="list-item-icon">
                    {branch.isCurrent ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                      </svg>
                    )}
                  </div>
                  <div className="list-item-info">
                    <span className="list-item-title">{branch.name}</span>
                    {branch.lastCommitDate && (
                      <span className="list-item-subtitle">
                        Last commit: {new Date(branch.lastCommitDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {!branch.isCurrent && (
                  <button
                    className="vscode-button-secondary vscode-button-small"
                    onClick={() => handleBranchSwitch(branch.name)}
                    title={`Switch to ${branch.name}`}
                  >
                    Switch
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Commits */}
      {recentCommits.length > 0 && (
        <div className="vscode-section">
          <div className="section-header">
            <h3 className="section-title">
              <svg className="section-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="m1.05 12 10.5 12L23 12"/>
              </svg>
              Recent Commits
            </h3>
            <span className="section-count">{recentCommits.length}</span>
          </div>
          <div className="vscode-list">
            {recentCommits.map((commit) => (
              <div key={commit.hash} className="vscode-list-item commit-item">
                <div className="list-item-content">
                  <div className="list-item-icon commit-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="4"/>
                    </svg>
                  </div>
                  <div className="list-item-info">
                    <span className="list-item-title commit-message" title={commit.message}>
                      {commit.message}
                    </span>
                    <div className="list-item-subtitle commit-meta">
                      <span className="commit-author">{commit.author}</span>
                      <span className="commit-separator">•</span>
                      <span className="commit-date">{new Date(commit.date).toLocaleDateString()}</span>
                      <span className="commit-separator">•</span>
                      <span className="commit-hash">{commit.shortHash}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changed Files */}
      {changedFiles.length > 0 && (
        <div className="vscode-section">
          <div className="section-header">
            <h3 className="section-title">
              <svg className="section-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              Changed Files
            </h3>
            <div className="section-actions">
              <span className="section-count">{changedFiles.length}</span>
              <button
                className="vscode-button-icon"
                onClick={() => handleShowDiff()}
                title="View all changes"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="vscode-list">
            {changedFiles.map((file) => (
              <div key={file.path} className="vscode-list-item file-item">
                <div className="list-item-content">
                  <div className="list-item-icon">
                    <div className={`file-status-icon ${file.status.toLowerCase()}`}>
                      {file.status === 'added' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      )}
                      {file.status === 'modified' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="1"/>
                        </svg>
                      )}
                      {file.status === 'deleted' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      )}
                      {file.status === 'renamed' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="16 18 22 12 16 6"/>
                          <polyline points="8 6 2 12 8 18"/>
                        </svg>
                      )}
                      {file.status === 'untracked' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="m9 12 2 2 4-4"/>
                        </svg>
                      )}
                      {!['added', 'modified', 'deleted', 'renamed', 'untracked'].includes(file.status) && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14,2 14,8 20,8"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="list-item-info">
                    <span className="list-item-title file-path" title={file.path}>
                      {file.path}
                    </span>
                    <div className="list-item-subtitle file-meta">
                      <span className={`file-status-text ${file.status.toLowerCase()}`}>
                        {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                      </span>
                      {file.staged && (
                        <>
                          <span className="commit-separator">•</span>
                          <span className="staged-indicator">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Staged
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  className="vscode-button-secondary vscode-button-small"
                  onClick={() => handleShowDiff(file.path)}
                  title={`View diff for ${file.path}`}
                >
                  Diff
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stashes List */}
      {stashes.length > 0 && (
        <div className="vscode-section">
          <div className="section-header">
            <h3 className="section-title">
              <svg className="section-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="m7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Stashes
            </h3>
            <span className="section-count">{stashes.length}</span>
          </div>
          <div className="vscode-list">
            {stashes.map((stash, index) => (
              <div key={stash.name} className="vscode-list-item stash-item">
                <div className="list-item-content">
                  <div className="list-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="m7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div className="list-item-info">
                    <span className="list-item-title stash-message">
                      {stash.message || 'No message'}
                    </span>
                    <span className="list-item-subtitle stash-date">
                      {new Date(stash.date).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="list-item-actions">
                  <button
                    className="vscode-button-secondary vscode-button-small"
                    onClick={() => handleApplyStash(index)}
                    title="Apply this stash"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="8 18 12 22 16 18"/>
                      <polyline points="12 2 12 22"/>
                    </svg>
                    Apply
                  </button>
                  <button
                    className="vscode-button-secondary vscode-button-small danger"
                    onClick={() => handleDropStash(index)}
                    title="Drop this stash"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="m19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Drop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commit Dialog */}
      {showCommitDialog && (
        <div className="vscode-modal-overlay">
          <div className="vscode-modal">
            <div className="modal-header">
              <h3 className="modal-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Commit Changes
              </h3>
              <button className="vscode-button-icon" onClick={() => setShowCommitDialog(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-content">
              <div className="vscode-form-group">
                <label className="vscode-label">Commit Message</label>
                <textarea
                  className="vscode-textarea"
                  placeholder="Enter commit message..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="vscode-button vscode-button-primary" onClick={handleCommit}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Commit
              </button>
              <button className="vscode-button vscode-button-secondary" onClick={() => setShowCommitDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stash Dialog */}
      {showStashDialog && (
        <div className="vscode-modal-overlay">
          <div className="vscode-modal">
            <div className="modal-header">
              <h3 className="modal-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="m7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Stash Changes
              </h3>
              <button className="vscode-button-icon" onClick={() => setShowStashDialog(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-content">
              <div className="vscode-form-group">
                <label className="vscode-label">Stash Message (Optional)</label>
                <textarea
                  className="vscode-textarea"
                  placeholder="Enter stash message..."
                  value={stashMessage}
                  onChange={(e) => setStashMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="vscode-button vscode-button-primary" onClick={handleCreateStash}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="m7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Stash
              </button>
              <button className="vscode-button vscode-button-secondary" onClick={() => setShowStashDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer */}
      {showDiffViewer && (
        <div className="vscode-modal-overlay">
          <div className="vscode-modal vscode-modal-large">
            <div className="modal-header">
              <h3 className="modal-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                {selectedFile ? `Diff: ${selectedFile}` : 'All Changes'}
              </h3>
              <button className="vscode-button-icon" onClick={() => setShowDiffViewer(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-content">
              <div className="vscode-diff-viewer">
                <pre className="vscode-code">{fileDiff}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitTab;
