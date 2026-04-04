import { FileWatcher } from './FileWatcher';
import { GitWatcher } from './GitWatcher';
import { CodeAnalyzer } from './CodeAnalyzer';
import { MonitorState, FileHealth } from '../types';

export interface MonitorCallbacks {
  readonly onFileCreated: (filePath: string) => void;
  readonly onFileChanged: (filePath: string) => void;
  readonly onFileDeleted: (filePath: string) => void;
  readonly onCommitDetected: (sha: string) => void;
  readonly onBugCountChanged: (count: number) => void;
  readonly onFileHealthChanged: (filePath: string, health: FileHealth) => void;
}

export class MonitorManager {
  private readonly fileWatcher: FileWatcher;
  private readonly gitWatcher: GitWatcher;
  private readonly codeAnalyzer: CodeAnalyzer;
  private bugCountByFile: Map<string, number> = new Map();
  private totalBugCount: number = 0;

  constructor(
    workspacePath: string,
    private readonly callbacks: MonitorCallbacks
  ) {
    this.codeAnalyzer = new CodeAnalyzer();
    this.codeAnalyzer.loadCustomPatterns(workspacePath);

    this.fileWatcher = new FileWatcher(workspacePath, {
      onFileAdd: (path) => this.handleFileAdd(path),
      onFileChange: (path) => this.handleFileChange(path),
      onFileDelete: (path) => this.handleFileDelete(path),
    });

    this.gitWatcher = new GitWatcher(workspacePath, {
      onCommit: (sha) => this.callbacks.onCommitDetected(sha),
    });
  }

  async start(): Promise<void> {
    this.fileWatcher.start();
    await this.gitWatcher.start();
  }

  stop(): void {
    this.fileWatcher.stop();
    this.gitWatcher.stop();
  }

  getState(): MonitorState {
    return {
      fileCount: this.bugCountByFile.size,
      bugCount: this.totalBugCount,
      lastCommitSha: this.gitWatcher.getLastSha(),
      lastCommitTime: this.gitWatcher.getLastCommitTime(),
    };
  }

  async getCommitStreak(): Promise<number> {
    return this.gitWatcher.getCommitStreak();
  }

  getBugCount(): number {
    return this.totalBugCount;
  }

  private handleFileAdd(filePath: string): void {
    if (!this.isSourceFile(filePath)) {
      return;
    }
    this.updateBugCount(filePath);
    const health = this.codeAnalyzer.analyzeFileDetailed(filePath);
    this.callbacks.onFileHealthChanged(filePath, health);
    this.callbacks.onFileCreated(filePath);
  }

  private handleFileChange(filePath: string): void {
    if (!this.isSourceFile(filePath)) {
      return;
    }
    this.updateBugCount(filePath);
    const health = this.codeAnalyzer.analyzeFileDetailed(filePath);
    this.callbacks.onFileHealthChanged(filePath, health);
    this.callbacks.onFileChanged(filePath);
  }

  private handleFileDelete(filePath: string): void {
    if (!this.isSourceFile(filePath)) {
      return;
    }
    this.bugCountByFile.delete(filePath);
    this.recalculateTotalBugs();
    this.callbacks.onFileDeleted(filePath);
  }

  private updateBugCount(filePath: string): void {
    const count = this.codeAnalyzer.analyzeFile(filePath);
    this.bugCountByFile.set(filePath, count);
    this.recalculateTotalBugs();
  }

  private recalculateTotalBugs(): void {
    let total = 0;
    for (const count of this.bugCountByFile.values()) {
      total += count;
    }
    if (total !== this.totalBugCount) {
      this.totalBugCount = total;
      this.callbacks.onBugCountChanged(total);
    }
  }

  private isSourceFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const sourceExtensions = [
      'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java',
      'rb', 'php', 'swift', 'kt', 'cs', 'c', 'cpp', 'h',
      'vue', 'svelte',
    ];
    if (!sourceExtensions.includes(ext)) return false;

    // Reject paths inside build output, dependencies, or hidden directories
    const lowerPath = filePath.toLowerCase().replace(/\\/g, '/');
    const rejected = [
      '/node_modules/', '/dist/', '/build/', '/.next/', '/.nuxt/',
      '/coverage/', '/.git/', '/.vscode/', '/out/',
    ];
    return !rejected.some(seg => lowerPath.includes(seg));
  }
}
