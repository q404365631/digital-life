import { CreatureData, Species, Position, CodingDNA, FileHealth } from '../types';
import { MAX_CREATURES } from '../constants';
import {
  createCreature,
  updateHatchProgress,
  updateCreatureNeeds,
  updateCreatureMovement,
  updateReactionTimer,
  feedCreature,
  petCreature,
  setCreatureMoodByBugs,
  addExp,
  checkCreatureInteraction,
} from './CreatureState';

export class CreatureManager {
  private creatures: Map<string, CreatureData> = new Map();
  private fileToCreatureId: Map<string, string> = new Map();

  getAll(): readonly CreatureData[] {
    return Array.from(this.creatures.values());
  }

  getById(id: string): CreatureData | undefined {
    return this.creatures.get(id);
  }

  getCount(): number {
    return this.creatures.size;
  }

  loadCreatures(creatures: readonly CreatureData[]): void {
    this.creatures.clear();
    this.fileToCreatureId.clear();
    for (const creature of creatures) {
      this.creatures.set(creature.id, creature);
      this.fileToCreatureId.set(creature.sourceFile, creature.id);
    }
  }

  spawnCreature(sourceFile: string, name: string, species: Species = 'dot', dna?: CodingDNA): CreatureData | null {
    if (this.creatures.size >= MAX_CREATURES) {
      return null;
    }

    if (this.fileToCreatureId.has(sourceFile)) {
      return null;
    }

    const creature = createCreature(sourceFile, name, species, dna);
    this.creatures.set(creature.id, creature);
    this.fileToCreatureId.set(sourceFile, creature.id);
    return creature;
  }

  hasCreatureForFile(filePath: string): boolean {
    return this.fileToCreatureId.has(filePath);
  }

  getByFile(filePath: string): string | undefined {
    return this.fileToCreatureId.get(filePath);
  }

  removeCreature(sourceFile: string): CreatureData | null {
    const creatureId = this.fileToCreatureId.get(sourceFile);
    if (!creatureId) {
      return null;
    }

    const creature = this.creatures.get(creatureId);
    this.creatures.delete(creatureId);
    this.fileToCreatureId.delete(sourceFile);
    return creature ?? null;
  }

  setHunger(creatureId: string, hunger: number): void {
    const creature = this.creatures.get(creatureId);
    if (creature) {
      this.creatures.set(creatureId, { ...creature, hunger });
    }
  }

  renameCreature(creatureId: string, name: string): void {
    const creature = this.creatures.get(creatureId);
    if (creature) {
      this.creatures.set(creatureId, { ...creature, name });
    }
  }

  feed(creatureId: string): void {
    const creature = this.creatures.get(creatureId);
    if (creature) {
      this.creatures.set(creatureId, feedCreature(creature));
    }
  }

  pet(creatureId: string): void {
    const creature = this.creatures.get(creatureId);
    if (creature) {
      this.creatures.set(creatureId, petCreature(creature));
    }
  }

  /** Update file health and return improvement info for reward calculation */
  updateFileHealth(sourceFile: string, health: FileHealth): { improved: boolean; bugsDelta: number; linesDelta: number } | null {
    const creatureId = this.fileToCreatureId.get(sourceFile);
    if (!creatureId) { return null; }
    const creature = this.creatures.get(creatureId);
    if (!creature) { return null; }

    const prev = creature.fileHealth;
    const bugsDelta = prev.bugCount - health.bugCount;  // positive = bugs fixed
    const linesDelta = prev.lineCount - health.lineCount; // positive = lines reduced

    let expReward = 0;
    if (bugsDelta > 0) { expReward += bugsDelta * 10; }  // 10 EXP per bug fixed
    if (linesDelta > 50) { expReward += 15; }             // 15 EXP for significant slimming

    let updated: CreatureData = { ...creature, fileHealth: health };
    if (expReward > 0) {
      updated = addExp(updated, expReward);
    }
    this.creatures.set(creatureId, updated);

    return {
      improved: expReward > 0,
      bugsDelta,
      linesDelta,
    };
  }

  moveCreature(creatureId: string, position: Position): void {
    const creature = this.creatures.get(creatureId);
    if (creature) {
      this.creatures.set(creatureId, {
        ...creature,
        position,
        targetPosition: null,
      });
    }
  }

  feedAll(): void {
    for (const [id, creature] of this.creatures) {
      this.creatures.set(id, feedCreature(creature));
    }
  }

  /** Returns IDs of creatures that leveled up */
  commitBonus(): string[] {
    const leveled: string[] = [];
    for (const [id, creature] of this.creatures) {
      const prevLevel = creature.level;
      const bonus = 10 + creature.level * 2;
      const updated = addExp(creature, bonus);
      this.creatures.set(id, updated);
      if (updated.level > prevLevel) { leveled.push(id); }
    }
    return leveled;
  }

  /** Award EXP when file health improves. Returns creature ID if leveled up. */
  healBonus(sourceFile: string): string | null {
    const creatureId = this.fileToCreatureId.get(sourceFile);
    if (!creatureId) { return null; }
    const creature = this.creatures.get(creatureId);
    if (!creature) { return null; }
    const prevLevel = creature.level;
    const updated = addExp(creature, 20);
    this.creatures.set(creatureId, updated);
    return updated.level > prevLevel ? creatureId : null;
  }

  updateBugEffect(hasBugs: boolean): void {
    for (const [id, creature] of this.creatures) {
      this.creatures.set(id, setCreatureMoodByBugs(creature, hasBugs));
    }
  }

  tick(deltaMs: number): void {
    const deltaMinutes = deltaMs / 60000;
    const snapshot = this.getAll();

    for (const [id, creature] of this.creatures) {
      let updated = updateHatchProgress(creature, deltaMs);
      updated = updateCreatureNeeds(updated, deltaMinutes);
      updated = updateReactionTimer(updated, deltaMs);
      updated = updateCreatureMovement(updated);
      updated = checkCreatureInteraction(updated, snapshot);

      // Advance animation frame
      updated = {
        ...updated,
        animationFrame: (updated.animationFrame + 1) % 4,
      };

      this.creatures.set(id, updated);
    }
  }
}
