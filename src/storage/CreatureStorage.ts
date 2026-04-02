import * as vscode from 'vscode';
import { StoredState, CreatureData, WorldData, MonitorState, AgentData } from '../types';
import { STORAGE_KEY } from '../constants';

export class CreatureStorage {
  constructor(private readonly globalState: vscode.Memento) {}

  save(creatures: readonly CreatureData[], world: WorldData, monitorState: MonitorState, agents: readonly AgentData[]): void {
    const state: StoredState = {
      creatures,
      world,
      monitorState,
      agents,
    };
    void this.globalState.update(STORAGE_KEY, state);
  }

  load(): StoredState | null {
    const raw = this.globalState.get<StoredState>(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    // Ensure graveStones field exists for backward compatibility
    const world: WorldData = {
      ...raw.world,
      graveStones: raw.world.graveStones ?? [],
    };
    // Ensure agents field exists for backward compatibility
    const agents: readonly AgentData[] = (raw as { agents?: readonly AgentData[] }).agents ?? [];
    return { ...raw, world, agents };
  }

  clear(): void {
    void this.globalState.update(STORAGE_KEY, undefined);
  }
}
