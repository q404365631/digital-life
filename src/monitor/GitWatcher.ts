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

  /** Count consecutive days with at least one commit (streak) */
  async getCommitStreak(): Promise<number> {
    try {
      // Fetch last 120 days of commits (enough for even long streaks)
      const log = await this.git.log({ maxCount: 500 });
      if (!log.all || log.all.length === 0) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Collect unique commit dates
      const commitDays = new Set<number>();
      for (const entry of log.all) {
        const d = new Date(entry.date);
        d.setHours(0, 0, 0, 0);
        commitDays.add(d.getTime());
      }

      // Count consecutive days backward from today
      let streak = 0;
      const dayMs = 86_400_000;
      let checkDay = today.getTime();

      // Allow today or yesterday as the starting point
      if (!commitDays.has(checkDay)) {
        checkDay -= dayMs; // yesterday
        if (!commitDays.has(checkDay)) return 0;
      }

      while (commitDays.has(checkDay)) {
        streak++;
        checkDay -= dayMs;
      }
      return streak;
    } catch {
      return 0;
    }
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
