import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreatureManager } from './CreatureManager';
import { MS_PER_DAY, MAX_CREATURES } from '../constants';

describe('CreatureManager', () => {
  let manager: CreatureManager;
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    manager = new CreatureManager();
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // spawnCreature
  // -----------------------------------------------------------------------
  describe('spawnCreature', () => {
    it('creates a creature and stores it', () => {
      const c = manager.spawnCreature('file.ts', 'Dotty', 'dot');
      expect(c).not.toBeNull();
      expect(c!.name).toBe('Dotty');
      expect(manager.getCount()).toBe(1);
    });

    it('returns null at max capacity', () => {
      for (let i = 0; i < MAX_CREATURES; i++) {
        manager.spawnCreature(`file${i}.ts`, `C${i}`);
      }
      expect(manager.getCount()).toBe(MAX_CREATURES);
      const overflow = manager.spawnCreature('overflow.ts', 'Overflow');
      expect(overflow).toBeNull();
    });

    it('prevents duplicate files', () => {
      manager.spawnCreature('same.ts', 'First');
      const dup = manager.spawnCreature('same.ts', 'Second');
      expect(dup).toBeNull();
      expect(manager.getCount()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // feed / pet
  // -----------------------------------------------------------------------
  describe('feed', () => {
    it('updates creature hunger', () => {
      const c = manager.spawnCreature('f.ts', 'F');
      // creature starts as egg — force to baby so feed works
      manager.loadCreatures(
        manager.getAll().map((cr) => ({ ...cr, stage: 'baby' as const }))
      );
      const id = c!.id;
      manager.feed(id);
      const updated = manager.getById(id);
      expect(updated!.hunger).toBeGreaterThan(80); // default hunger is 80, feed adds 30
    });
  });

  describe('pet', () => {
    it('updates creature happiness', () => {
      const c = manager.spawnCreature('f.ts', 'F');
      manager.loadCreatures(
        manager.getAll().map((cr) => ({ ...cr, stage: 'baby' as const }))
      );
      const id = c!.id;
      manager.pet(id);
      const updated = manager.getById(id);
      expect(updated!.happiness).toBeGreaterThan(80);
    });
  });

  // -----------------------------------------------------------------------
  // removeCreature
  // -----------------------------------------------------------------------
  describe('removeCreature', () => {
    it('removes by file path', () => {
      manager.spawnCreature('a.ts', 'A');
      const removed = manager.removeCreature('a.ts');
      expect(removed).not.toBeNull();
      expect(removed!.name).toBe('A');
      expect(manager.getCount()).toBe(0);
    });

    it('returns null for unknown file', () => {
      const result = manager.removeCreature('nope.ts');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // checkNeglect
  // -----------------------------------------------------------------------
  describe('checkNeglect', () => {
    it('warns at 2 days without feeding', () => {
      manager.spawnCreature('f.ts', 'F');
      // Force to baby and set lastFed in the past
      const twoDaysAgo = 1_000_000_000 - MS_PER_DAY * 2;
      manager.loadCreatures(
        manager.getAll().map((cr) => ({
          ...cr,
          stage: 'baby' as const,
          lastFed: twoDaysAgo,
          neglectWarned: false,
        }))
      );

      const { critical, dead } = manager.checkNeglect();
      expect(critical).toHaveLength(1);
      expect(dead).toHaveLength(0);
    });

    it('reports death at 3 days without feeding', () => {
      manager.spawnCreature('f.ts', 'F');
      const threeDaysAgo = 1_000_000_000 - MS_PER_DAY * 3;
      manager.loadCreatures(
        manager.getAll().map((cr) => ({
          ...cr,
          stage: 'baby' as const,
          lastFed: threeDaysAgo,
          neglectWarned: false,
        }))
      );

      const { critical, dead } = manager.checkNeglect();
      expect(dead).toHaveLength(1);
    });

    it('skips eggs', () => {
      manager.spawnCreature('f.ts', 'F');
      const threeDaysAgo = 1_000_000_000 - MS_PER_DAY * 3;
      manager.loadCreatures(
        manager.getAll().map((cr) => ({
          ...cr,
          stage: 'egg' as const,
          lastFed: threeDaysAgo,
        }))
      );

      const { critical, dead } = manager.checkNeglect();
      expect(critical).toHaveLength(0);
      expect(dead).toHaveLength(0);
    });

    it('does not re-warn already warned creatures', () => {
      manager.spawnCreature('f.ts', 'F');
      const twoDaysAgo = 1_000_000_000 - MS_PER_DAY * 2;
      manager.loadCreatures(
        manager.getAll().map((cr) => ({
          ...cr,
          stage: 'baby' as const,
          lastFed: twoDaysAgo,
          neglectWarned: true,
        }))
      );

      const { critical } = manager.checkNeglect();
      expect(critical).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // commitBonus
  // -----------------------------------------------------------------------
  describe('commitBonus', () => {
    it('all creatures get exp', () => {
      manager.spawnCreature('a.ts', 'A');
      manager.spawnCreature('b.ts', 'B');
      // Force to baby so they are at level 1
      manager.loadCreatures(
        manager.getAll().map((cr) => ({ ...cr, stage: 'baby' as const }))
      );

      const beforeExp = manager.getAll().map((c) => c.exp);
      manager.commitBonus();
      const afterExp = manager.getAll().map((c) => c.exp);

      for (let i = 0; i < beforeExp.length; i++) {
        expect(afterExp[i]).toBeGreaterThan(beforeExp[i]);
      }
    });

    it('returns ids of creatures that leveled up', () => {
      manager.spawnCreature('a.ts', 'A');
      // Set exp just below level 2 threshold (100), bonus = 10 + 1*2 = 12
      manager.loadCreatures(
        manager.getAll().map((cr) => ({
          ...cr,
          stage: 'baby' as const,
          exp: 95,
          level: 1,
        }))
      );

      const leveled = manager.commitBonus();
      expect(leveled.length).toBe(1);
    });

    it('returns empty array when no one levels up', () => {
      manager.spawnCreature('a.ts', 'A');
      manager.loadCreatures(
        manager.getAll().map((cr) => ({
          ...cr,
          stage: 'baby' as const,
          exp: 0,
          level: 1,
        }))
      );

      const leveled = manager.commitBonus();
      expect(leveled).toHaveLength(0);
    });
  });
});
