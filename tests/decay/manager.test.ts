import { DecayManager } from '../../src/decay/manager';
import type { ResolvedConfig, MemoryItem } from '../../src/types';
import type { SqliteStorage } from '../../src/storage/sqlite';

function makeConfig(overrides?: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    dataDir: '/tmp/test',
    embedding: { dimensions: 384, embed: async () => [] },
    llm: null,
    tokenBudget: { contextWindow: 128000, systemPromptReserve: 2000, outputReserve: 1000 },
    archive: { quietMinutes: 5, windowHours: 24, minBatch: 5, maxBatch: 20 },
    decay: { dormantAfterDays: 90, expireAfterDays: 180 },
    limits: { maxConversationMessages: 500, maxLongTermMemories: 1000 },
    onDecayWarning: null,
    ...overrides,
  };
}

describe('DecayManager', () => {
  describe('isDormant', () => {
    it('returns false for recently created memory', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      expect(dm.isDormant(Date.now(), null)).toBe(false);
    });

    it('returns true for old memory with no access', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      const oldTime = Date.now() - 100 * 24 * 3600 * 1000; // 100 days ago
      expect(dm.isDormant(oldTime, null)).toBe(true);
    });

    it('uses lastAccessed if available', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      const oldCreated = Date.now() - 100 * 24 * 3600 * 1000;
      const recentAccess = Date.now() - 1000; // 1 second ago
      expect(dm.isDormant(oldCreated, recentAccess)).toBe(false);
    });

    it('returns true when lastAccessed is also old', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      const old = Date.now() - 100 * 24 * 3600 * 1000;
      expect(dm.isDormant(old, old)).toBe(true);
    });
  });

  describe('decayFactor', () => {
    it('returns ~1 for freshly created memory', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      expect(dm.decayFactor(Date.now(), null)).toBeCloseTo(1.0, 1);
    });

    it('returns 0.5 at dormantAfterDays', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      const halfLife = Date.now() - 90 * 24 * 3600 * 1000;
      expect(dm.decayFactor(halfLife, null)).toBeCloseTo(0.5, 1);
    });

    it('returns small value for very old memory', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      const veryOld = Date.now() - 365 * 24 * 3600 * 1000;
      expect(dm.decayFactor(veryOld, null)).toBeLessThan(0.1);
    });

    it('uses lastAccessed when available', () => {
      const config = makeConfig();
      const dm = new DecayManager(config, {} as SqliteStorage);
      const old = Date.now() - 200 * 24 * 3600 * 1000;
      const recent = Date.now();
      expect(dm.decayFactor(old, recent)).toBeCloseTo(1.0, 1);
    });
  });

  describe('runDecayCheck', () => {
    it('returns count of dormant candidates', () => {
      const candidates = [
        { id: 'ltm_1', category: 'fact', key: 'k', value: 'v', embedding_id: 'e', confidence: 0.7, access_count: 0, last_accessed: null, is_active: 1, created_at: 0 },
        { id: 'ltm_2', category: 'fact', key: 'k', value: 'v', embedding_id: 'e', confidence: 0.7, access_count: 0, last_accessed: null, is_active: 1, created_at: 0 },
      ];
      const storage = { findDormantCandidates: jest.fn().mockReturnValue(candidates) } as any;
      const config = makeConfig();
      const dm = new DecayManager(config, storage);

      expect(dm.runDecayCheck()).toBe(2);
      expect(storage.findDormantCandidates).toHaveBeenCalled();
    });

    it('calls onDecayWarning for each candidate', () => {
      const warningFn = jest.fn();
      const candidates = [
        { id: 'ltm_1', category: 'preference', key: 'k', value: 'v', embedding_id: 'e', confidence: 0.8, access_count: 5, last_accessed: 1000, is_active: 1, created_at: 500 },
      ];
      const storage = { findDormantCandidates: jest.fn().mockReturnValue(candidates) } as any;
      const config = makeConfig({ onDecayWarning: warningFn });
      const dm = new DecayManager(config, storage);

      dm.runDecayCheck();
      expect(warningFn).toHaveBeenCalledTimes(1);
      const item: MemoryItem = warningFn.mock.calls[0][0];
      expect(item.id).toBe('ltm_1');
      expect(item.category).toBe('preference');
      expect(item.isActive).toBe(true);
    });

    it('returns 0 when no candidates', () => {
      const storage = { findDormantCandidates: jest.fn().mockReturnValue([]) } as any;
      const dm = new DecayManager(makeConfig(), storage);
      expect(dm.runDecayCheck()).toBe(0);
    });
  });
});
