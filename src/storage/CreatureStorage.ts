import * as vscode from 'vscode';
import { StoredState, CreatureData, WorldData, MonitorState, AgentData, STORED_STATE_VERSION } from '../types';
import { STORAGE_KEY } from '../constants';

export class CreatureStorage {
  constructor(private readonly globalState: vscode.Memento) {}

  save(creatures: readonly CreatureData[], world: WorldData, monitorState: MonitorState, agents: readonly AgentData[]): void {
    const state: StoredState = {
      version: STORED_STATE_VERSION,
      creatures,
      world,
      monitorState,
      agents,
    };
    // eslint-disable-next-line no-console -- intentional error logging for storage failures
    void this.globalState.update(STORAGE_KEY, state).then(undefined, (err: unknown) => console.error('Storage save failed:', err));
  }

  load(): StoredState | null {
    const raw = this.globalState.get<StoredState>(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    // Validate required fields exist
    if (!raw.world || !raw.creatures || !raw.monitorState) {
      return null;
    }
    // Ensure graveStones field exists for backward compatibility
    const world: WorldData = {
      ...raw.world,
      graveStones: raw.world.graveStones ?? [],
    };
    // Ensure agents field exists for backward compatibility
    const agents: readonly AgentData[] = (raw as { agents?: readonly AgentData[] }).agents ?? [];
    const version = (raw as { version?: number }).version ?? 1;
    return { ...raw, version, world, agents };
  }

  clear(): void {
    void this.globalState.update(STORAGE_KEY, undefined);
  }
}
