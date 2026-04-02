import * as chokidar from 'chokidar';
import { EXCLUDED_PATTERNS, FILE_DEBOUNCE } from '../constants';

export type FileEvent = 'add' | 'change' | 'unlink';

export interface FileWatcherCallbacks {
  readonly onFileAdd: (filePath: string) => void;
  readonly onFileChange: (filePath: string) => void;
  readonly onFileDelete: (filePath: string) => void;
}

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private readonly debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    private readonly workspacePath: string,
    private readonly callbacks: FileWatcherCallbacks
  ) {}

  start(): void {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch(this.workspacePath, {
      ignored: EXCLUDED_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: FILE_DEBOUNCE,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (path) => this.handleEvent('add', path));
    this.watcher.on('change', (path) => this.handleEvent('change', path));
    this.watcher.on('unlink', (path) => this.handleEvent('unlink', path));
  }

  stop(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private handleEvent(event: FileEvent, filePath: string): void {
    const key = `${event}:${filePath}`;
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      switch (event) {
        case 'add':
          this.callbacks.onFileAdd(filePath);
          break;
        case 'change':
          this.callbacks.onFileChange(filePath);
          break;
        case 'unlink':
          this.callbacks.onFileDelete(filePath);
          break;
      }
    }, FILE_DEBOUNCE);

    this.debounceTimers.set(key, timer);
  }
}
