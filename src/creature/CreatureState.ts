import { CreatureData, CreatureMood, CreatureStage, AnimationState, Position, ReactionType, Species, CodingDNA } from '../types';
import { defaultDNA } from './DNAAnalyzer';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, SPRITE_SIZE,
  HUNGER_DECAY_RATE, HAPPINESS_DECAY_RATE,
  FEED_AMOUNT, PET_AMOUNT, HATCH_DURATION,
  CREATURE_SPEED,
} from '../constants';

function generateId(): string {
  return `creature_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function randomPosition(): Position {
  const margin = SPRITE_SIZE * 2;
  return {
    x: margin + Math.floor(Math.random() * (CANVAS_WIDTH - margin * 2)),
    y: margin + Math.floor(Math.random() * (CANVAS_HEIGHT - margin * 2)),
  };
}

function randomTarget(): Position {
  const margin = SPRITE_SIZE * 2;
  return {
    x: margin + Math.floor(Math.random() * (CANVAS_WIDTH - margin * 2)),
    y: margin + Math.floor(Math.random() * (CANVAS_HEIGHT - margin * 2)),
  };
}

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];

export function calculateLevel(exp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function calculateStage(level: number): CreatureStage {
  if (level <= 2) return 'egg';
  if (level <= 6) return 'baby';
  return 'adult';
}

export function addExp(creature: CreatureData, amount: number): CreatureData {
  const newExp = creature.exp + amount;
  const newLevel = calculateLevel(newExp);
  const newStage = calculateStage(newLevel);
  return {
    ...creature,
    exp: newExp,
    level: newLevel,
    stage: newStage,
  };
}

export function createCreature(sourceFile: string, name: string, species: Species = 'dot', dna?: CodingDNA): CreatureData {
  const pos = randomPosition();
  return {
    id: generateId(),
    name,
    stage: 'egg',
    mood: 'happy',
    hunger: 80,
    happiness: 80,
    position: pos,
    targetPosition: null,
    animationState: 'idle',
    animationFrame: 0,
    sourceFile,
    bornAt: Date.now(),
    hatchProgress: 0,
    lastFed: Date.now(),
    lastPetted: Date.now(),
    reactionType: null,
    reactionTimer: 0,
    species,
    exp: 0,
    level: 1,
    dna: dna ?? defaultDNA(),
    fileHealth: { lineCount: 0, bugCount: 0, lastModified: Date.now() },
  };
}

export function updateHatchProgress(creature: CreatureData, deltaMs: number): CreatureData {
  if (creature.stage !== 'egg') {
    return creature;
  }

  const increment = (deltaMs / HATCH_DURATION) * 100;
  const newProgress = Math.min(100, creature.hatchProgress + increment);

  if (newProgress >= 100) {
    return {
      ...creature,
      stage: 'baby' as CreatureStage,
      hatchProgress: 100,
      animationState: 'idle' as AnimationState,
    };
  }

  return {
    ...creature,
    hatchProgress: newProgress,
    animationState: 'hatch' as AnimationState,
  };
}

export function updateCreatureNeeds(creature: CreatureData, deltaMinutes: number): CreatureData {
  if (creature.stage === 'egg') {
    return creature;
  }

  const newHunger = Math.max(0, creature.hunger - HUNGER_DECAY_RATE * deltaMinutes);
  const newHappiness = Math.max(0, creature.happiness - HAPPINESS_DECAY_RATE * deltaMinutes);

  return {
    ...creature,
    hunger: newHunger,
    happiness: newHappiness,
    mood: calculateMood(newHunger, newHappiness),
  };
}

const REACTION_DURATION = 1500; // ms

export function feedCreature(creature: CreatureData): CreatureData {
  if (creature.stage === 'egg') {
    return creature;
  }

  const newHunger = Math.min(100, creature.hunger + FEED_AMOUNT);
  const withExp = addExp(creature, 5);
  return {
    ...withExp,
    hunger: newHunger,
    mood: calculateMood(newHunger, creature.happiness),
    animationState: 'eat' as AnimationState,
    animationFrame: 0,
    lastFed: Date.now(),
    reactionType: 'feed' as ReactionType,
    reactionTimer: REACTION_DURATION,
  };
}

export function petCreature(creature: CreatureData): CreatureData {
  if (creature.stage === 'egg') {
    return creature;
  }

  const newHappiness = Math.min(100, creature.happiness + PET_AMOUNT);
  const withExp = addExp(creature, 3);
  return {
    ...withExp,
    happiness: newHappiness,
    mood: calculateMood(creature.hunger, newHappiness),
    animationState: 'happy' as AnimationState,
    animationFrame: 0,
    lastPetted: Date.now(),
    reactionType: 'pet' as ReactionType,
    reactionTimer: REACTION_DURATION,
  };
}

export function updateReactionTimer(creature: CreatureData, deltaMs: number): CreatureData {
  if (creature.reactionTimer <= 0) {
    return creature;
  }

  const newTimer = Math.max(0, creature.reactionTimer - deltaMs);
  if (newTimer <= 0) {
    return {
      ...creature,
      reactionType: null,
      reactionTimer: 0,
      animationState: 'idle' as AnimationState,
    };
  }

  return {
    ...creature,
    reactionTimer: newTimer,
  };
}

export function updateCreatureMovement(creature: CreatureData): CreatureData {
  if (creature.stage === 'egg') {
    return creature;
  }

  // Don't move during reactions
  if (creature.reactionTimer > 0) {
    return creature;
  }

  if (creature.animationState === 'eat' || creature.animationState === 'happy') {
    return creature;
  }

  // DNA-based speed multiplier: 0.5x ~ 1.5x
  const speedMultiplier = 0.5 + creature.dna.velocity;
  const speed = CREATURE_SPEED * speedMultiplier;

  if (!creature.targetPosition) {
    // DNA consistency affects idle→walk transition probability
    // High consistency = regular timing (base 0.01), low consistency = wider random range
    const baseChance = 0.01;
    const randomRange = (1 - creature.dna.consistency) * 0.02;
    const moveChance = baseChance + (Math.random() - 0.5) * randomRange;

    if (Math.random() < moveChance) {
      const target = randomTarget();
      const dx = target.x - creature.position.x;
      const dy = target.y - creature.position.y;
      const walkState = getWalkDirection(dx, dy);
      return {
        ...creature,
        targetPosition: target,
        animationState: walkState,
        animationFrame: 0,
      };
    }
    return {
      ...creature,
      animationState: 'idle' as AnimationState,
    };
  }

  const dx = creature.targetPosition.x - creature.position.x;
  const dy = creature.targetPosition.y - creature.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < speed * 2) {
    return {
      ...creature,
      position: creature.targetPosition,
      targetPosition: null,
      animationState: 'idle' as AnimationState,
      animationFrame: 0,
    };
  }

  const nx = dx / distance;
  const ny = dy / distance;

  return {
    ...creature,
    position: {
      x: creature.position.x + nx * speed,
      y: creature.position.y + ny * speed,
    },
    animationState: getWalkDirection(dx, dy),
  };
}

export function setCreatureMoodByBugs(creature: CreatureData, hasBugs: boolean): CreatureData {
  if (creature.stage === 'egg') {
    return creature;
  }

  if (hasBugs) {
    return {
      ...creature,
      mood: 'sad' as CreatureMood,
      animationState: 'sad' as AnimationState,
    };
  }

  return {
    ...creature,
    mood: calculateMood(creature.hunger, creature.happiness),
  };
}

function calculateMood(hunger: number, happiness: number): CreatureMood {
  const avg = (hunger + happiness) / 2;
  if (avg > 60) return 'happy';
  if (avg > 30) return 'neutral';
  return 'sad';
}

function getWalkDirection(dx: number, dy: number): AnimationState {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'walk_right' : 'walk_left';
  }
  return dy > 0 ? 'walk_down' : 'walk_up';
}

const INTERACTION_DISTANCE = 30;
const SOCIAL_PROXIMITY = 12;

/** Check for nearby creatures and apply social interaction (walk together + happiness bonus). */
export function checkCreatureInteraction(
  creature: CreatureData,
  others: readonly CreatureData[]
): CreatureData {
  if (creature.stage === 'egg') {
    return creature;
  }

  if (creature.reactionTimer > 0) {
    return creature;
  }

  for (const other of others) {
    if (other.id === creature.id) {
      continue;
    }
    if (other.stage === 'egg') {
      continue;
    }
    if (other.reactionTimer > 0) {
      continue;
    }

    const dx = other.position.x - creature.position.x;
    const dy = other.position.y - creature.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < INTERACTION_DISTANCE) {
      const targetX = other.position.x + (dx > 0 ? -SOCIAL_PROXIMITY : SOCIAL_PROXIMITY);
      const targetY = other.position.y + (dy > 0 ? -SOCIAL_PROXIMITY : SOCIAL_PROXIMITY);

      const margin = SPRITE_SIZE * 2;
      const clampedX = Math.max(margin, Math.min(CANVAS_WIDTH - margin, targetX));
      const clampedY = Math.max(margin, Math.min(CANVAS_HEIGHT - margin, targetY));

      const newHappiness = Math.min(100, creature.happiness + 1);

      return {
        ...creature,
        targetPosition: { x: clampedX, y: clampedY },
        happiness: newHappiness,
        mood: calculateMood(creature.hunger, newHappiness),
      };
    }
  }

  return creature;
}
