import * as vscode from 'vscode';
import { StoredState, CreatureData, WorldData, MonitorState } from '../types';
import { STORAGE_KEY } from '../constants';

export class CreatureStorage {
  constructor(private readonly globalState: vscode.Memento) {}

  save(creatures: readonly CreatureData[], world: WorldData, monitorState: MonitorState): void {
    const state: StoredState = {
      creatures,
      world,
      monitorState,
    };
    void this.globalState.update(STORAGE_KEY, state);
  }

  load(): StoredState | null {
    const raw = this.globalState.get<StoredState>(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return raw;
  }

  clear(): void {
    void this.globalState.update(STORAGE_KEY, undefined);
  }
}
