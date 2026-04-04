import { CreatureData, Species, Position, CodingDNA, FileHealth, MutationType } from '../types';
import { MAX_CREATURES, NEGLECT_DEATH_DAYS, NEGLECT_WARNING_DAYS, MS_PER_DAY } from '../constants';
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

  /** Update file health and return detailed change info */
  updateFileHealth(sourceFile: string, health: FileHealth): {
    improved: boolean;
    worsened: boolean;
    bugsDelta: number;
    linesDelta: number;
    nestingDelta: number;
  } | null {
    const creatureId = this.fileToCreatureId.get(sourceFile);
    if (!creatureId) { return null; }
    const creature = this.creatures.get(creatureId);
    if (!creature) { return null; }

    const prev = creature.fileHealth;
    const bugsDelta = prev.bugCount - health.bugCount;  // positive = bugs fixed
    const linesDelta = prev.lineCount - health.lineCount; // positive = lines reduced
    const nestingDelta = (prev.maxNesting ?? 0) - (health.maxNesting ?? 0); // positive = shallower

    let expReward = 0;
    if (bugsDelta > 0) { expReward += bugsDelta * 10; }
    if (linesDelta > 50) { expReward += 15; }
    if (nestingDelta > 2) { expReward += 10; }

    const worsened = bugsDelta < -1 || linesDelta < -50 || nestingDelta < -2;

    let updated: CreatureData = { ...creature, fileHealth: health };
    if (expReward > 0) {
      updated = addExp(updated, expReward);
    }
    this.creatures.set(creatureId, updated);

    return {
      improved: expReward > 0,
      worsened,
      bugsDelta,
      linesDelta,
      nestingDelta,
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

  /** Set walk target (creature animates toward it) */
  setTargetPosition(creatureId: string, target: Position): void {
    const creature = this.creatures.get(creatureId);
    if (creature && creature.stage !== 'egg') {
      this.creatures.set(creatureId, { ...creature, targetPosition: target });
    }
  }

  /** Clear all walk targets — creatures resume free movement */
  clearAllTargets(): void {
    for (const [id, creature] of this.creatures) {
      if (creature.targetPosition) {
        this.creatures.set(id, { ...creature, targetPosition: null });
      }
    }
  }

  /** Check for neglected creatures. Returns { critical, dead } creature lists */
  checkNeglect(): { critical: CreatureData[]; dead: CreatureData[] } {
    const now = Date.now();
    const critical: CreatureData[] = [];
    const dead: CreatureData[] = [];

    for (const [id, creature] of this.creatures) {
      if (creature.stage === 'egg') continue;

      const daysSinceLastFed = (now - creature.lastFed) / MS_PER_DAY;

      if (daysSinceLastFed >= NEGLECT_DEATH_DAYS) {
        dead.push(creature);
      } else if (daysSinceLastFed >= NEGLECT_WARNING_DAYS && !creature.neglectWarned) {
        critical.push(creature);
        this.creatures.set(id, { ...creature, neglectWarned: true });
      }
    }

    return { critical, dead };
  }

  /** Remove a creature by ID (for neglect death) */
  removeCreatureById(id: string): CreatureData | null {
    const creature = this.creatures.get(id);
    if (!creature) return null;
    this.creatures.delete(id);
    this.fileToCreatureId.delete(creature.sourceFile);
    return creature;
  }

  /** Set mutation on a creature */
  setMutation(creatureId: string, mutation: MutationType): void {
    const creature = this.creatures.get(creatureId);
    if (creature) {
      this.creatures.set(creatureId, { ...creature, mutation });
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
