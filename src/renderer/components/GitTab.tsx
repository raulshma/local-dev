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
      <div className="git-tab">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading Git information...</span>
        </div>
      </div>
    );
  }

  if (!gitStatus?.isRepository) {
    return (
      <div className="git-tab">
        <div className="no-git-repo">
          <div className="no-git-icon">🚫</div>
          <h3>Not a Git Repository</h3>
          <p>This project is not a Git repository or Git is not available.</p>
          <button className="refresh-btn" onClick={handleRefresh}>
            🔄 Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="git-tab">
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
          <button className="close-error" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Git Status Section */}
      <div className="git-section">
        <div className="section-header">
          <h3>Git Status</h3>
          <button className="refresh-btn" onClick={handleRefresh}>
            🔄
          </button>
        </div>

        <div className="git-status-grid">
          <div className="status-card">
            <div className="status-label">Current Branch</div>
            <div className="status-value">{gitStatus.currentBranch || 'Unknown'}</div>
          </div>

          <div className="status-card">
            <div className="status-label">Changes</div>
            <div className="status-value">
              {gitStatus.hasUncommittedChanges ? (
                <span className="changes-indicator">
                  {gitStatus.staged > 0 && <span className="staged">+{gitStatus.staged}</span>}
                  {gitStatus.unstaged > 0 && <span className="unstaged">~{gitStatus.unstaged}</span>}
                  {gitStatus.untracked > 0 && <span className="untracked">?{gitStatus.untracked}</span>}
                </span>
              ) : (
                <span className="clean">Clean</span>
              )}
            </div>
          </div>

          <div className="status-card">
            <div className="status-label">Remote Status</div>
            <div className="status-value">
              {gitStatus.ahead > 0 && <span className="ahead">↑{gitStatus.ahead}</span>}
              {gitStatus.behind > 0 && <span className="behind">↓{gitStatus.behind}</span>}
              {gitStatus.ahead === 0 && gitStatus.behind === 0 && <span className="synced">Synced</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="git-section">
        <h3>Quick Actions</h3>
        <div className="git-actions">
          <button
            className="git-action-btn pull"
            onClick={handlePull}
            disabled={gitStatus.behind === 0}
            title={gitStatus.behind > 0 ? `Pull ${gitStatus.behind} commit(s)` : 'No changes to pull'}
          >
            ⬇️ Pull {gitStatus.behind > 0 && `(${gitStatus.behind})`}
          </button>
            <button
            className="git-action-btn push"
            onClick={handlePush}
            disabled={gitStatus.ahead === 0}
            title={gitStatus.ahead > 0 ? `Push ${gitStatus.ahead} commit(s)` : 'No changes to push'}
          >
            ⬆️ Push {gitStatus.ahead > 0 && `(${gitStatus.ahead})`}
          </button>

          <button
            className="git-action-btn commit"
            onClick={() => setShowCommitDialog(true)}
            disabled={!gitStatus.hasUncommittedChanges}
            title={gitStatus.hasUncommittedChanges ? 'Create a new commit' : 'No changes to commit'}
          >
            💾 Commit
          </button>
            <button
            className="git-action-btn refresh"
            onClick={handleRefresh}
            title="Refresh Git status"
          >
            🔄 Refresh
          </button>          <button
            type="button"
            className="git-action-btn open-client"
            onClick={handleOpenInGitClient}
            title="Open project in Git client"
          >
            🛠️ Git Client
          </button>

          <button
            type="button"
            className="git-action-btn stash"
            onClick={() => setShowStashDialog(true)}
            disabled={!gitStatus.hasUncommittedChanges}
            title={
              gitStatus.hasUncommittedChanges
                ? 'Stash current changes'
                : 'No changes to stash'
            }
          >
            💼 Stash
          </button>

          <button
            type="button"
            className="git-action-btn pop-stash"
            onClick={handlePopStash}
            disabled={stashes.length === 0}
            title={stashes.length > 0 ? 'Pop latest stash' : 'No stashes available'}
          >
            📤 Pop Stash
          </button>
        </div>
      </div>

      {/* Branches Section */}
      {branches.length > 0 && (
        <div className="git-section">
          <h3>Branches</h3>
          <div className="branches-list">
            {branches.slice(0, 5).map((branch) => (
              <div
                key={branch.name}
                className={`branch-item ${branch.isCurrent ? 'current' : ''}`}
              >
                <div className="branch-info">
                  <span className="branch-name">
                    {branch.isCurrent && '● '}
                    {branch.name}
                  </span>
                  {branch.lastCommitDate && (
                    <span className="branch-date">
                      {new Date(branch.lastCommitDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {!branch.isCurrent && (
                  <button
                    className="switch-branch-btn"
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
        <div className="git-section">
          <h3>Recent Commits</h3>
          <div className="commits-list">
            {recentCommits.map((commit) => (
              <div key={commit.hash} className="commit-item">
                <div className="commit-hash">{commit.shortHash}</div>
                <div className="commit-info">
                  <div className="commit-message">{commit.message}</div>
                  <div className="commit-meta">
                    <span className="commit-author">{commit.author}</span>
                    <span className="commit-date">{new Date(commit.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>        </div>
      )}

      {/* Changed Files */}
      {changedFiles.length > 0 && (
        <div className="git-section">
          <div className="section-header">
            <h3>Changed Files ({changedFiles.length})</h3>
            <button
              type="button"
              className="view-all-diff-btn"
              onClick={() => handleShowDiff()}
              title="View all changes"
            >
              👁️ View All
            </button>
          </div>
          <div className="changed-files-list">
            {changedFiles.map((file) => (
              <div key={file.path} className="changed-file-item">
                <div className="file-info">
                  <span className={`file-status ${file.status.toLowerCase()}`}>
                    {file.status === 'added' && '➕'}
                    {file.status === 'modified' && '📝'}
                    {file.status === 'deleted' && '➖'}
                    {file.status === 'renamed' && '📋'}
                    {file.status === 'untracked' && '❓'}
                    {!['added', 'modified', 'deleted', 'renamed', 'untracked'].includes(file.status) && '📄'}
                  </span>
                  <span className="file-path" title={file.path}>
                    {file.path}
                  </span>
                  {file.staged && <span className="staged-indicator">✓</span>}
                </div>
                <button
                  type="button"
                  className="view-file-diff-btn"
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

      {/* Commit Dialog */}
      {showCommitDialog && (
        <div className="commit-dialog">
          <div className="dialog-content">
            <h3>Commit Changes</h3>
            <textarea
              className="commit-message"
              placeholder="Enter commit message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}            />
            <div className="dialog-actions">
              <button className="btn commit" onClick={handleCommit}>
                ✅ Commit
              </button>
              <button className="btn cancel" onClick={() => setShowCommitDialog(false)}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer */}
      {showDiffViewer && (
        <div className="diff-viewer">
          <div className="viewer-header">
            <h3>File Diff</h3>
            <button className="close-viewer" onClick={() => setShowDiffViewer(false)}>
              ❌
            </button>
          </div>
          <div className="viewer-content">
            <pre>{fileDiff}</pre>
          </div>
        </div>
      )}

      {/* Stash Management Dialog */}
      {showStashDialog && (
        <div className="stash-dialog">
          <div className="dialog-content">
            <h3>Stash Changes</h3>
            <textarea
              className="stash-message"
              placeholder="Enter stash message (optional)"
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
            />
            <div className="dialog-actions">
              <button className="btn stash" onClick={handleCreateStash}>
                💼 Stash
              </button>
              <button className="btn cancel" onClick={() => setShowStashDialog(false)}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stashes List */}
      {stashes.length > 0 && (
        <div className="git-section">
          <h3>Stashes</h3>
          <div className="stashes-list">            {stashes.map((stash, index) => (
              <div key={stash.name} className="stash-item">
                <div className="stash-info">
                  <span className="stash-message">{stash.message || 'No message'}</span>
                  <span className="stash-date">
                    {new Date(stash.date).toLocaleString()}
                  </span>
                </div>
                <div className="stash-actions">
                  <button
                    className="btn apply-stash"
                    onClick={() => handleApplyStash(index)}
                    title="Apply this stash"
                  >
                    ⬇️ Apply
                  </button>
                  <button
                    className="btn drop-stash"
                    onClick={() => handleDropStash(index)}
                    title="Drop this stash"
                  >
                    🗑️ Drop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitTab;
