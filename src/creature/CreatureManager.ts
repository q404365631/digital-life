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

  updateFileHealth(sourceFile: string, health: FileHealth): void {
    const creatureId = this.fileToCreatureId.get(sourceFile);
    if (!creatureId) return;
    const creature = this.creatures.get(creatureId);
    if (!creature) return;
    this.creatures.set(creatureId, { ...creature, fileHealth: health });
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

  commitBonus(): void {
    for (const [id, creature] of this.creatures) {
      this.creatures.set(id, addExp(creature, 10));
    }
  }

  updateBugEffect(hasBugs: boolean): void {
    for (const [id, creature] of this.creatures) {
      this.creatures.set(id, setCreatureMoodByBugs(creature, hasBugs));
    }
  }

  tick(deltaMs: number): void {
    const deltaMinutes = deltaMs / 60000;

    for (const [id, creature] of this.creatures) {
      let updated = updateHatchProgress(creature, deltaMs);
      updated = updateCreatureNeeds(updated, deltaMinutes);
      updated = updateReactionTimer(updated, deltaMs);
      updated = updateCreatureMovement(updated);
      updated = checkCreatureInteraction(updated, this.getAll());

      // Advance animation frame
      updated = {
        ...updated,
        animationFrame: (updated.animationFrame + 1) % 4,
      };

      this.creatures.set(id, updated);
    }
  }
}
