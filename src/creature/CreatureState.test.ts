import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateLevel,
  calculateStage,
  createCreature,
  feedCreature,
  petCreature,
  updateCreatureNeeds,
  determineMutation,
  addExp,
  checkCreatureInteraction,
} from './CreatureState';
import { CreatureData, CodingDNA } from '../types';
import {
  FEED_AMOUNT,
  PET_AMOUNT,
  HUNGER_DECAY_RATE,
  HAPPINESS_DECAY_RATE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPRITE_SIZE,
} from '../constants';

// ---------------------------------------------------------------------------
// calculateLevel
// ---------------------------------------------------------------------------
describe('calculateLevel', () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [299, 2],
    [300, 3],
    [599, 3],
    [600, 4],
    [999, 4],
    [1000, 5],
    [1499, 5],
    [1500, 6],
    [2199, 6],
    [2200, 7],
    [2999, 7],
    [3000, 8],
    [3999, 8],
    [4000, 9],
    [5499, 9],
    [5500, 10],
    [99999, 10],
  ])('exp %i → level %i', (exp, expected) => {
    expect(calculateLevel(exp)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// calculateStage
// ---------------------------------------------------------------------------
describe('calculateStage', () => {
  it('levels 1-2 are egg', () => {
    expect(calculateStage(1)).toBe('egg');
    expect(calculateStage(2)).toBe('egg');
  });

  it('levels 3-6 are baby', () => {
    expect(calculateStage(3)).toBe('baby');
    expect(calculateStage(4)).toBe('baby');
    expect(calculateStage(5)).toBe('baby');
    expect(calculateStage(6)).toBe('baby');
  });

  it('level 7+ is adult', () => {
    expect(calculateStage(7)).toBe('adult');
    expect(calculateStage(10)).toBe('adult');
  });
});

// ---------------------------------------------------------------------------
// createCreature
// ---------------------------------------------------------------------------
describe('createCreature', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('returns correct defaults', () => {
    const c = createCreature('src/index.ts', 'TestCreature');
    expect(c.name).toBe('TestCreature');
    expect(c.sourceFile).toBe('src/index.ts');
    expect(c.stage).toBe('egg');
    expect(c.mood).toBe('happy');
    expect(c.hunger).toBe(80);
    expect(c.happiness).toBe(80);
    expect(c.exp).toBe(0);
    expect(c.level).toBe(1);
    expect(c.mutation).toBeNull();
    expect(c.neglectWarned).toBe(false);
    expect(c.species).toBe('dot'); // default species
  });

  it('uses the provided species', () => {
    const c = createCreature('main.py', 'Puffy', 'puff');
    expect(c.species).toBe('puff');
  });

  it('position is within canvas bounds', () => {
    const margin = SPRITE_SIZE * 2;
    for (let i = 0; i < 20; i++) {
      const c = createCreature(`file${i}.ts`, `C${i}`);
      expect(c.position.x).toBeGreaterThanOrEqual(margin);
      expect(c.position.x).toBeLessThanOrEqual(CANVAS_WIDTH - margin);
      expect(c.position.y).toBeGreaterThanOrEqual(margin);
      expect(c.position.y).toBeLessThanOrEqual(CANVAS_HEIGHT - margin);
    }
  });
});

// ---------------------------------------------------------------------------
// feedCreature
// ---------------------------------------------------------------------------
describe('feedCreature', () => {
  function makeBabyCreature(overrides: Partial<CreatureData> = {}): CreatureData {
    return {
      id: 'c1',
      name: 'Test',
      stage: 'baby',
      mood: 'happy',
      hunger: 50,
      happiness: 50,
      position: { x: 100, y: 100 },
      targetPosition: null,
      animationState: 'idle',
      animationFrame: 0,
      sourceFile: 'test.ts',
      bornAt: 0,
      hatchProgress: 100,
      lastFed: 0,
      lastPetted: 0,
      reactionType: null,
      reactionTimer: 0,
      species: 'dot',
      exp: 0,
      level: 1,
      dna: { commitFrequency: 0.5, nightOwl: 0.5, polyglot: 0.5, velocity: 0.5, consistency: 0.5 },
      fileHealth: { lineCount: 0, bugCount: 0, lastModified: 0, maxNesting: 0, longestFunction: 0 },
      mutation: null,
      neglectWarned: false,
      ...overrides,
    };
  }

  it('increases hunger by FEED_AMOUNT', () => {
    const c = makeBabyCreature({ hunger: 50 });
    const fed = feedCreature(c);
    expect(fed.hunger).toBe(50 + FEED_AMOUNT);
  });

  it('caps hunger at 100', () => {
    const c = makeBabyCreature({ hunger: 90 });
    const fed = feedCreature(c);
    expect(fed.hunger).toBe(100);
  });

  it('updates lastFed', () => {
    const now = 5000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const c = makeBabyCreature({ lastFed: 0 });
    const fed = feedCreature(c);
    expect(fed.lastFed).toBe(now);
    vi.restoreAllMocks();
  });

  it('adds exp', () => {
    const c = makeBabyCreature({ exp: 0 });
    const fed = feedCreature(c);
    expect(fed.exp).toBe(5);
  });

  it('does nothing for eggs', () => {
    const c = makeBabyCreature({ stage: 'egg', hunger: 50 });
    const fed = feedCreature(c);
    expect(fed.hunger).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// petCreature
// ---------------------------------------------------------------------------
describe('petCreature', () => {
  function makeBabyCreature(overrides: Partial<CreatureData> = {}): CreatureData {
    return {
      id: 'c1',
      name: 'Test',
      stage: 'baby',
      mood: 'happy',
      hunger: 50,
      happiness: 50,
      position: { x: 100, y: 100 },
      targetPosition: null,
      animationState: 'idle',
      animationFrame: 0,
      sourceFile: 'test.ts',
      bornAt: 0,
      hatchProgress: 100,
      lastFed: 0,
      lastPetted: 0,
      reactionType: null,
      reactionTimer: 0,
      species: 'dot',
      exp: 0,
      level: 1,
      dna: { commitFrequency: 0.5, nightOwl: 0.5, polyglot: 0.5, velocity: 0.5, consistency: 0.5 },
      fileHealth: { lineCount: 0, bugCount: 0, lastModified: 0, maxNesting: 0, longestFunction: 0 },
      mutation: null,
      neglectWarned: false,
      ...overrides,
    };
  }

  it('increases happiness by PET_AMOUNT', () => {
    const c = makeBabyCreature({ happiness: 50 });
    const petted = petCreature(c);
    expect(petted.happiness).toBe(50 + PET_AMOUNT);
  });

  it('adds exp', () => {
    const c = makeBabyCreature({ exp: 0 });
    const petted = petCreature(c);
    expect(petted.exp).toBe(3);
  });

  it('does nothing for eggs', () => {
    const c = makeBabyCreature({ stage: 'egg', happiness: 50 });
    const petted = petCreature(c);
    expect(petted.happiness).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// updateCreatureNeeds
// ---------------------------------------------------------------------------
describe('updateCreatureNeeds', () => {
  function makeBabyCreature(overrides: Partial<CreatureData> = {}): CreatureData {
    return {
      id: 'c1',
      name: 'Test',
      stage: 'baby',
      mood: 'happy',
      hunger: 80,
      happiness: 80,
      position: { x: 100, y: 100 },
      targetPosition: null,
      animationState: 'idle',
      animationFrame: 0,
      sourceFile: 'test.ts',
      bornAt: 0,
      hatchProgress: 100,
      lastFed: 0,
      lastPetted: 0,
      reactionType: null,
      reactionTimer: 0,
      species: 'dot',
      exp: 0,
      level: 1,
      dna: { commitFrequency: 0.5, nightOwl: 0.5, polyglot: 0.5, velocity: 0.5, consistency: 0.5 },
      fileHealth: { lineCount: 0, bugCount: 0, lastModified: 0, maxNesting: 0, longestFunction: 0 },
      mutation: null,
      neglectWarned: false,
      ...overrides,
    };
  }

  it('decays hunger and happiness over time', () => {
    const c = makeBabyCreature({ hunger: 80, happiness: 80 });
    const deltaMinutes = 10;
    const updated = updateCreatureNeeds(c, deltaMinutes);
    expect(updated.hunger).toBe(80 - HUNGER_DECAY_RATE * deltaMinutes);
    expect(updated.happiness).toBe(80 - HAPPINESS_DECAY_RATE * deltaMinutes);
  });

  it('does not go below 0', () => {
    const c = makeBabyCreature({ hunger: 1, happiness: 1 });
    const updated = updateCreatureNeeds(c, 1000);
    expect(updated.hunger).toBe(0);
    expect(updated.happiness).toBe(0);
  });

  it('eggs do not decay', () => {
    const c = makeBabyCreature({ stage: 'egg', hunger: 80, happiness: 80 });
    const updated = updateCreatureNeeds(c, 100);
    expect(updated.hunger).toBe(80);
    expect(updated.happiness).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// determineMutation
// ---------------------------------------------------------------------------
describe('determineMutation', () => {
  const baseDNA: CodingDNA = {
    commitFrequency: 0.3,
    nightOwl: 0.3,
    polyglot: 0.3,
    velocity: 0.3,
    consistency: 0.3,
  };

  it('returns nightGlow for dominant nightOwl', () => {
    expect(determineMutation({ ...baseDNA, nightOwl: 0.9 })).toBe('nightGlow');
  });

  it('returns rainbow for dominant polyglot', () => {
    expect(determineMutation({ ...baseDNA, polyglot: 0.8 })).toBe('rainbow');
  });

  it('returns speedster for dominant velocity', () => {
    expect(determineMutation({ ...baseDNA, velocity: 0.7 })).toBe('speedster');
  });

  it('returns zen for dominant consistency', () => {
    expect(determineMutation({ ...baseDNA, consistency: 0.75 })).toBe('zen');
  });

  it('returns hyperactive for dominant commitFrequency', () => {
    expect(determineMutation({ ...baseDNA, commitFrequency: 0.85 })).toBe('hyperactive');
  });

  it('returns null if no trait exceeds 0.6', () => {
    expect(determineMutation(baseDNA)).toBeNull();
  });

  it('picks the highest trait when multiple exceed 0.6', () => {
    expect(determineMutation({ ...baseDNA, nightOwl: 0.7, velocity: 0.9 })).toBe('speedster');
  });
});

// ---------------------------------------------------------------------------
// addExp
// ---------------------------------------------------------------------------
describe('addExp', () => {
  function makeBabyCreature(overrides: Partial<CreatureData> = {}): CreatureData {
    return {
      id: 'c1',
      name: 'Test',
      stage: 'baby',
      mood: 'happy',
      hunger: 50,
      happiness: 50,
      position: { x: 100, y: 100 },
      targetPosition: null,
      animationState: 'idle',
      animationFrame: 0,
      sourceFile: 'test.ts',
      bornAt: 0,
      hatchProgress: 100,
      lastFed: 0,
      lastPetted: 0,
      reactionType: null,
      reactionTimer: 0,
      species: 'dot',
      exp: 0,
      level: 1,
      dna: { commitFrequency: 0.5, nightOwl: 0.5, polyglot: 0.5, velocity: 0.5, consistency: 0.5 },
      fileHealth: { lineCount: 0, bugCount: 0, lastModified: 0, maxNesting: 0, longestFunction: 0 },
      mutation: null,
      neglectWarned: false,
      ...overrides,
    };
  }

  it('increases exp', () => {
    const c = makeBabyCreature({ exp: 50 });
    const result = addExp(c, 25);
    expect(result.exp).toBe(75);
  });

  it('triggers level up', () => {
    const c = makeBabyCreature({ exp: 90, level: 1 });
    const result = addExp(c, 15); // 105 → level 2
    expect(result.level).toBe(2);
  });

  it('triggers stage change from egg to baby at level 3', () => {
    const c = makeBabyCreature({ exp: 290, level: 2, stage: 'egg' });
    const result = addExp(c, 15); // 305 → level 3 → baby
    expect(result.level).toBe(3);
    expect(result.stage).toBe('baby');
  });

  it('triggers stage change from baby to adult at level 7', () => {
    const c = makeBabyCreature({ exp: 2190, level: 6, stage: 'baby' });
    const result = addExp(c, 15); // 2205 → level 7 → adult
    expect(result.level).toBe(7);
    expect(result.stage).toBe('adult');
  });

  it('does not regress stage', () => {
    // A creature already at adult stage with low exp should stay adult
    const c = makeBabyCreature({ exp: 50, level: 1, stage: 'adult' });
    const result = addExp(c, 5);
    expect(result.stage).toBe('adult');
  });

  it('unlocks mutation at level 5 (MUTATION_UNLOCK_LEVEL)', () => {
    const dna: CodingDNA = {
      commitFrequency: 0.3,
      nightOwl: 0.9,
      polyglot: 0.3,
      velocity: 0.3,
      consistency: 0.3,
    };
    const c = makeBabyCreature({ exp: 990, level: 4, stage: 'baby', dna, mutation: null });
    const result = addExp(c, 15); // 1005 → level 5
    expect(result.level).toBe(5);
    expect(result.mutation).toBe('nightGlow');
  });

  it('does not re-assign mutation if already set', () => {
    const c = makeBabyCreature({ exp: 990, level: 4, stage: 'baby', mutation: 'zen' });
    const result = addExp(c, 15);
    expect(result.mutation).toBe('zen');
  });
});

// ---------------------------------------------------------------------------
// checkCreatureInteraction
// ---------------------------------------------------------------------------
describe('checkCreatureInteraction', () => {
  function makeCreature(id: string, x: number, y: number, overrides: Partial<CreatureData> = {}): CreatureData {
    return {
      id,
      name: id,
      stage: 'baby',
      mood: 'happy',
      hunger: 50,
      happiness: 50,
      position: { x, y },
      targetPosition: null,
      animationState: 'idle',
      animationFrame: 0,
      sourceFile: `${id}.ts`,
      bornAt: 0,
      hatchProgress: 100,
      lastFed: 0,
      lastPetted: 0,
      reactionType: null,
      reactionTimer: 0,
      species: 'dot',
      exp: 0,
      level: 1,
      dna: { commitFrequency: 0.5, nightOwl: 0.5, polyglot: 0.5, velocity: 0.5, consistency: 0.5 },
      fileHealth: { lineCount: 0, bugCount: 0, lastModified: 0, maxNesting: 0, longestFunction: 0 },
      mutation: null,
      neglectWarned: false,
      ...overrides,
    };
  }

  it('returns unchanged if creature is an egg', () => {
    const c = makeCreature('a', 100, 100, { stage: 'egg' });
    const other = makeCreature('b', 110, 100);
    const result = checkCreatureInteraction(c, [c, other]);
    expect(result).toEqual(c);
  });

  it('gives happiness bonus when nearby', () => {
    const c = makeCreature('a', 100, 100);
    const other = makeCreature('b', 115, 100); // distance = 15, < 30 threshold
    const result = checkCreatureInteraction(c, [c, other]);
    expect(result.happiness).toBe(51);
  });

  it('no interaction when far apart', () => {
    const c = makeCreature('a', 100, 100);
    const other = makeCreature('b', 200, 200);
    const result = checkCreatureInteraction(c, [c, other]);
    expect(result.happiness).toBe(50);
  });

  it('skips egg neighbours', () => {
    const c = makeCreature('a', 100, 100);
    const eggNeighbour = makeCreature('b', 110, 100, { stage: 'egg' });
    const result = checkCreatureInteraction(c, [c, eggNeighbour]);
    expect(result.happiness).toBe(50);
  });
});
