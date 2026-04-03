import simpleGit, { SimpleGit } from 'simple-git';
import { GIT_POLL_INTERVAL } from '../constants';

export interface GitWatcherCallbacks {
  readonly onCommit: (sha: string) => void;
}

export class GitWatcher {
  private git: SimpleGit;
  private lastSha: string = '';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private stopped: boolean = false;
  private _lastCommitTime: number = 0;

  constructor(
    private readonly workspacePath: string,
    private readonly callbacks: GitWatcherCallbacks
  ) {
    this.git = simpleGit(workspacePath);
  }

  async start(): Promise<void> {
    this.stopped = false;

    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        return;
      }
      const log = await this.git.log({ maxCount: 1 });
      if (log.latest) {
        this.lastSha = log.latest.hash;
      }
    } catch {
      return;
    }

    if (this.stopped) {
      return;
    }

    this.pollTimer = setInterval(() => {
      void this.checkForNewCommit();
    }, GIT_POLL_INTERVAL);
  }

  stop(): void {
    this.stopped = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getLastSha(): string {
    return this.lastSha;
  }

  getLastCommitTime(): number {
    return this._lastCommitTime;
  }

  private async checkForNewCommit(): Promise<void> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      if (log.latest && log.latest.hash !== this.lastSha) {
        this.lastSha = log.latest.hash;
        this._lastCommitTime = Date.now();
        this.callbacks.onCommit(log.latest.hash);
      }
    } catch {
      // Git operation failed, skip this cycle
    }
  }
}
