import simpleGit, { SimpleGit } from 'simple-git';
import { GIT_POLL_INTERVAL } from '../constants';

export interface GitWatcherCallbacks {
  readonly onCommit: (sha: string) => void;
}

export class GitWatcher {
  private git: SimpleGit;
  private lastSha: string = '';
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly workspacePath: string,
    private readonly callbacks: GitWatcherCallbacks
  ) {
    this.git = simpleGit(workspacePath);
  }

  async start(): Promise<void> {
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

    this.pollTimer = setInterval(() => {
      void this.checkForNewCommit();
    }, GIT_POLL_INTERVAL);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getLastSha(): string {
    return this.lastSha;
  }

  private async checkForNewCommit(): Promise<void> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      if (log.latest && log.latest.hash !== this.lastSha) {
        this.lastSha = log.latest.hash;
        this.callbacks.onCommit(log.latest.hash);
      }
    } catch {
      // Git operation failed, skip this cycle
    }
  }
}
