import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { GitStatus, GitBranch, GitCommit, GitRemote } from '../../types';

const execAsync = promisify(exec);

export class GitService {
  /**
   * Check if a directory is a Git repository
   */
  static async isGitRepository(projectPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: projectPath,
        timeout: 5000
      });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get Git status for a project
   */
  static async getGitStatus(projectPath: string): Promise<GitStatus> {
    const defaultStatus: GitStatus = {
      isRepository: false,
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      clean: true,
      hasUncommittedChanges: false
    };

    try {
      const isRepo = await this.isGitRepository(projectPath);
      if (!isRepo) {
        return defaultStatus;
      }

      const [
        currentBranch,
        remoteStatus,
        statusResult,
        remoteUrl
      ] = await Promise.all([
        this.getCurrentBranch(projectPath),
        this.getRemoteStatus(projectPath),
        this.getStatus(projectPath),
        this.getRemoteUrl(projectPath)
      ]);

      return {
        isRepository: true,
        currentBranch,
        ahead: remoteStatus.ahead,
        behind: remoteStatus.behind,
        staged: statusResult.staged,
        unstaged: statusResult.unstaged,
        untracked: statusResult.untracked,
        clean: statusResult.clean,
        remoteUrl,
        hasUncommittedChanges: statusResult.staged > 0 || statusResult.unstaged > 0 || statusResult.untracked > 0
      };
    } catch (error) {
      console.error('Error getting Git status:', error);
      return defaultStatus;
    }
  }

  /**
   * Get current branch name
   */
  static async getCurrentBranch(projectPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: projectPath,
        timeout: 5000
      });
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get remote tracking status (ahead/behind)
   */
  static async getRemoteStatus(projectPath: string): Promise<{ ahead: number; behind: number }> {
    try {      const { stdout } = await execAsync('git rev-list --count --left-right @{upstream}...HEAD 2>/dev/null || echo "0	0"', {
        cwd: projectPath,
        timeout: 5000
      });

      const [behind, ahead] = stdout.trim().split('\t').map(Number);
      return { ahead: ahead || 0, behind: behind || 0 };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  /**
   * Get working directory status
   */
  static async getStatus(projectPath: string): Promise<{
    staged: number;
    unstaged: number;
    untracked: number;
    clean: boolean;
  }> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: projectPath,
        timeout: 5000
      });

      const lines = stdout.trim().split('\n').filter(line => line);
      let staged = 0;
      let unstaged = 0;
      let untracked = 0;

      lines.forEach(line => {
        const statusCode = line.substring(0, 2);

        // First character indicates staged status
        if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
          staged++;
        }

        // Second character indicates unstaged status
        if (statusCode[1] !== ' ') {
          if (statusCode[1] === '?') {
            untracked++;
          } else {
            unstaged++;
          }
        }
      });

      return {
        staged,
        unstaged,
        untracked,
        clean: lines.length === 0
      };
    } catch {
      return { staged: 0, unstaged: 0, untracked: 0, clean: true };
    }
  }

  /**
   * Get remote URL
   */
  static async getRemoteUrl(projectPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.url', {
        cwd: projectPath,
        timeout: 5000
      });
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get list of branches
   */
  static async getBranches(projectPath: string): Promise<GitBranch[]> {
    try {
      const { stdout } = await execAsync('git branch -vv --all', {
        cwd: projectPath,
        timeout: 10000
      });

      const branches: GitBranch[] = [];
      const lines = stdout.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const isCurrent = trimmed.startsWith('*');
        const cleanLine = trimmed.replace(/^\*?\s*/, '');
        const parts = cleanLine.split(/\s+/);

        if (parts.length >= 2) {
          const name = parts[0];
          const lastCommit = parts[1];
          const isRemote = name.startsWith('remotes/');

          // Extract upstream information
          const upstreamMatch = line.match(/\[([^\]]+)\]/);
          const upstream = upstreamMatch ? upstreamMatch[1] : undefined;

          branches.push({
            name: isRemote ? name.replace('remotes/', '') : name,
            isCurrent,
            isRemote,
            upstream,
            lastCommit,
            lastCommitDate: undefined // Could be enhanced with git log
          });
        }
      });

      return branches;
    } catch (error) {
      console.error('Error getting branches:', error);
      return [];
    }
  }

  /**
   * Get recent commits
   */
  static async getRecentCommits(projectPath: string, limit: number = 10): Promise<GitCommit[]> {
    try {
      const { stdout } = await execAsync(`git log --oneline -n ${limit} --pretty=format:"%H|%h|%an|%ad|%s" --date=short`, {
        cwd: projectPath,
        timeout: 10000
      });

      const commits: GitCommit[] = [];
      const lines = stdout.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 5) {
          commits.push({
            hash: parts[0],
            shortHash: parts[1],
            author: parts[2],
            date: parts[3],
            message: parts[4],
            files: [] // Could be enhanced with git show --name-only
          });
        }
      });

      return commits;
    } catch (error) {
      console.error('Error getting commits:', error);
      return [];
    }
  }

  /**
   * Switch to a different branch
   */
  static async switchBranch(projectPath: string, branchName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`git checkout ${branchName}`, {
        cwd: projectPath,
        timeout: 30000
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull latest changes
   */
  static async pullChanges(projectPath: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('git pull', {
        cwd: projectPath,
        timeout: 60000
      });
      return { success: true, output: stdout + stderr };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Push changes
   */
  static async pushChanges(projectPath: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('git push', {
        cwd: projectPath,
        timeout: 60000
      });
      return { success: true, output: stdout + stderr };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Commit changes with a message
   */
  static async commitChanges(projectPath: string, message: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: projectPath,
        timeout: 30000
      });
      return { success: true, output: stdout + stderr };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Stage all changes
   */
  static async stageAllChanges(projectPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync('git add .', {
        cwd: projectPath,
        timeout: 30000
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get diff for uncommitted changes
   */
  static async getDiff(projectPath: string, filePath?: string): Promise<string> {
    try {
      const command = filePath
        ? `git diff HEAD -- "${filePath}"`
        : 'git diff HEAD';

      const { stdout } = await execAsync(command, {
        cwd: projectPath,
        timeout: 30000
      });
      return stdout;
    } catch (error) {
      console.error('Error getting diff:', error);
      return '';
    }
  }

  /**
   * Get list of changed files
   */
  static async getChangedFiles(projectPath: string): Promise<Array<{
    path: string;
    status: string;
    staged: boolean;
  }>> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: projectPath,
        timeout: 10000
      });

      const files: Array<{path: string; status: string; staged: boolean}> = [];
      const lines = stdout.trim().split('\n').filter(line => line);

      lines.forEach(line => {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);

        // Check if file is staged (first character)
        const staged = statusCode[0] !== ' ' && statusCode[0] !== '?';

        // Determine status
        let status = 'modified';
        if (statusCode.includes('A')) status = 'added';
        else if (statusCode.includes('D')) status = 'deleted';
        else if (statusCode.includes('R')) status = 'renamed';
        else if (statusCode.includes('M')) status = 'modified';
        else if (statusCode.includes('?')) status = 'untracked';

        files.push({
          path: filePath,
          status,
          staged
        });
      });

      return files;
    } catch (error) {
      console.error('Error getting changed files:', error);
      return [];
    }
  }

  /**
   * Create a new stash
   */
  static async createStash(projectPath: string, message?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const command = message
        ? `git stash push -m "${message}"`
        : 'git stash push';

      await execAsync(command, {
        cwd: projectPath,
        timeout: 30000
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get list of stashes
   */
  static async getStashes(projectPath: string): Promise<Array<{
    index: number;
    name: string;
    message: string;
    date: string;
  }>> {
    try {
      const { stdout } = await execAsync('git stash list --pretty=format:"%gd|%s|%cr"', {
        cwd: projectPath,
        timeout: 10000
      });

      const stashes: Array<{index: number; name: string; message: string; date: string}> = [];
      const lines = stdout.split('\n').filter(line => line.trim());

      lines.forEach((line, index) => {
        const parts = line.split('|');
        if (parts.length >= 3) {
          stashes.push({
            index,
            name: parts[0],
            message: parts[1],
            date: parts[2]
          });
        }
      });

      return stashes;
    } catch (error) {
      console.error('Error getting stashes:', error);
      return [];
    }
  }

  /**
   * Apply a stash
   */
  static async applyStash(projectPath: string, stashIndex: number): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`git stash apply stash@{${stashIndex}}`, {
        cwd: projectPath,
        timeout: 30000
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Drop a stash
   */
  static async dropStash(projectPath: string, stashIndex: number): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`git stash drop stash@{${stashIndex}}`, {
        cwd: projectPath,
        timeout: 30000
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Pop latest stash
   */
  static async popStash(projectPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync('git stash pop', {
        cwd: projectPath,
        timeout: 30000
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
