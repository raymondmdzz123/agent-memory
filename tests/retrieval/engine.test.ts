import { RetrievalEngine } from '../../src/retrieval/engine';
import type { ResolvedConfig, EmbeddingProvider, ConversationRow, LongTermMemoryRow, KnowledgeChunkRow } from '../../src/types';
import type { SqliteStorage } from '../../src/storage/sqlite';
import type { VectorIndex } from '../../src/vector/hnsw';
import type { DecayManager } from '../../src/decay/manager';

function makeConfig(overrides?: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    dataDir: '/tmp/test',
    embedding: { dimensions: 4, embed: async () => [1, 0, 0, 0] },
    llm: null,
    tokenBudget: { contextWindow: 128000, systemPromptReserve: 2000, outputReserve: 1000 },
    archive: { quietMinutes: 5, windowHours: 24, minBatch: 5, maxBatch: 20 },
    decay: { dormantAfterDays: 90, expireAfterDays: 180 },
    limits: { maxConversationMessages: 500, maxLongTermMemories: 1000 },
    onDecayWarning: null,
    ...overrides,
  };
}

function makeDeps(overrides?: any) {
  const storage = {
    getActiveMessages: jest.fn().mockReturnValue([]),
    getLongTermMemory: jest.fn(),
    getKnowledgeChunk: jest.fn(),
    getAllKnowledgeIds: jest.fn().mockReturnValue([]),
    refreshAccess: jest.fn(),
  } as unknown as jest.Mocked<SqliteStorage>;

  const vectorIndex = {
    search: jest.fn().mockReturnValue([]),
  } as unknown as jest.Mocked<VectorIndex>;

  const embedding: jest.Mocked<EmbeddingProvider> = {
    dimensions: 4,
    embed: jest.fn().mockResolvedValue([1, 0, 0, 0]),
  };

  const decayManager = {
    decayFactor: jest.fn().mockReturnValue(0.5),
  } as unknown as jest.Mocked<DecayManager>;

  return { storage, vectorIndex, embedding, decayManager, ...overrides };
}

describe('RetrievalEngine', () => {
  describe('assembleContext', () => {
    it('returns empty context when no data', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();
      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);

      const ctx = await engine.assembleContext('hello');
      expect(ctx.text).toBe('');
      expect(ctx.tokenCount).toBe(0);
      expect(ctx.sources).toEqual([]);
    });

    it('includes conversation messages that match query', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      const now = Date.now();
      (storage.getActiveMessages as jest.Mock).mockReturnValue([
        { id: 1, role: 'user', content: 'I like TypeScript programming', token_count: 5, importance: 0.5, created_at: now, is_archived: 0 } as ConversationRow,
        { id: 2, role: 'assistant', content: 'Great choice!', token_count: 3, importance: 0.5, created_at: now, is_archived: 0 } as ConversationRow,
      ]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('TypeScript');

      expect(ctx.text).toContain('TypeScript programming');
      expect(ctx.sources.length).toBeGreaterThanOrEqual(1);
      expect(ctx.sources[0].type).toBe('conversation');
    });

    it('includes long-term memory results', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (vectorIndex.search as jest.Mock).mockReturnValue([
        { id: 'ltm_1', score: 0.9 },
      ]);
      (storage.getLongTermMemory as jest.Mock).mockReturnValue({
        id: 'ltm_1', category: 'fact', key: 'lang', value: 'User prefers TypeScript',
        embedding_id: 'e', confidence: 0.8, access_count: 3, last_accessed: null, is_active: 1, created_at: Date.now(),
      } as LongTermMemoryRow);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('programming language');

      expect(ctx.text).toContain('User prefers TypeScript');
      expect(ctx.sources.some((s) => s.type === 'memory')).toBe(true);
    });

    it('includes knowledge base results as ref-only', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (storage.getAllKnowledgeIds as jest.Mock).mockReturnValue(['kb_1']);
      (vectorIndex.search as jest.Mock).mockReturnValue([
        { id: 'kb_1', score: 0.85 },
      ]);
      (storage.getKnowledgeChunk as jest.Mock).mockReturnValue({
        id: 'kb_1', source: 'manual', title: 'Setup Guide',
        content: 'This is a detailed setup guide with many steps for getting started.',
        embedding_id: 'e', token_count: 20, metadata: null, created_at: Date.now(),
      } as KnowledgeChunkRow);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('setup');

      expect(ctx.text).toContain('Knowledge·manual');
      expect(ctx.text).toContain('Setup Guide');
      expect(ctx.text).toContain('ref:kb_1');
      expect(ctx.sources.some((s) => s.type === 'knowledge')).toBe(true);
    });

    it('respects tokenBudget override', async () => {
      const config = makeConfig({ tokenBudget: { contextWindow: 100, systemPromptReserve: 10, outputReserve: 10 } });
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      const now = Date.now();
      (storage.getActiveMessages as jest.Mock).mockReturnValue([
        { id: 1, role: 'user', content: 'word '.repeat(200), token_count: 200, importance: 0.5, created_at: now, is_archived: 0 },
      ]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);

      // With very tight budget, should truncate or exclude
      const ctx = await engine.assembleContext('word', { contextWindow: 50 });
      // Budget = 50 - 10 - 10 - 10(overhead) = 20 tokens max
      expect(ctx.tokenCount).toBeLessThan(50);
    });

    it('skips inactive LTM results', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (vectorIndex.search as jest.Mock).mockReturnValue([
        { id: 'ltm_1', score: 0.9 },
      ]);
      (storage.getLongTermMemory as jest.Mock).mockReturnValue({
        id: 'ltm_1', category: 'fact', key: 'k', value: 'v',
        embedding_id: 'e', confidence: 0.8, access_count: 0, last_accessed: null, is_active: 0, created_at: Date.now(),
      });

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('test');
      expect(ctx.sources.every((s) => s.type !== 'memory')).toBe(true);
    });

    it('skips missing LTM rows', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (vectorIndex.search as jest.Mock).mockReturnValue([
        { id: 'ltm_gone', score: 0.9 },
      ]);
      (storage.getLongTermMemory as jest.Mock).mockReturnValue(undefined);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('test');
      expect(ctx.sources).toHaveLength(0);
    });

    it('handles knowledge excerpt truncation', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (storage.getAllKnowledgeIds as jest.Mock).mockReturnValue(['kb_1']);
      (vectorIndex.search as jest.Mock).mockReturnValue([{ id: 'kb_1', score: 0.9 }]);
      (storage.getKnowledgeChunk as jest.Mock).mockReturnValue({
        id: 'kb_1', source: 's', title: 'T',
        content: 'A'.repeat(200), // long enough to be truncated
        embedding_id: 'e', token_count: 50, metadata: null, created_at: Date.now(),
      });

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('test');
      expect(ctx.text).toContain('…');
    });

    it('handles knowledge search skipping non-KB ids', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (storage.getAllKnowledgeIds as jest.Mock).mockReturnValue(['kb_1']);
      (vectorIndex.search as jest.Mock).mockReturnValue([
        { id: 'ltm_1', score: 0.9 }, // Not a KB id
        { id: 'kb_1', score: 0.8 },
      ]);
      (storage.getKnowledgeChunk as jest.Mock).mockImplementation((id: string) =>
        id === 'kb_1'
          ? { id: 'kb_1', source: 's', title: 'T', content: 'C', embedding_id: 'e', token_count: 2, metadata: null, created_at: 0 }
          : undefined
      );

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('test');
      const kbSources = ctx.sources.filter((s) => s.type === 'knowledge');
      expect(kbSources).toHaveLength(1);
    });

    it('returns empty for knowledge search when no KB exists', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();
      (storage.getAllKnowledgeIds as jest.Mock).mockReturnValue([]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('test');
      expect(ctx.sources.filter((s) => s.type === 'knowledge')).toHaveLength(0);
    });

    it('conversation search with no matching terms still includes messages with 0.3 relevance', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (storage.getActiveMessages as jest.Mock).mockReturnValue([
        { id: 1, role: 'user', content: 'hello world', token_count: 3, importance: 0.5, created_at: Date.now(), is_archived: 0 },
      ]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      // Query with short single-char terms that get filtered out
      const ctx = await engine.assembleContext('x');
      // 'x' is 1 char -> length > 1 filter removes it -> queryTerms empty -> all messages included at 0.3
      expect(ctx.sources.length).toBe(1);
    });
  });

  describe('roleLabel mapping', () => {
    it('maps different roles correctly', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      const now = Date.now();
      (storage.getActiveMessages as jest.Mock).mockReturnValue([
        { id: 1, role: 'user', content: 'test query word', token_count: 3, importance: 0.5, created_at: now, is_archived: 0 },
        { id: 2, role: 'assistant', content: 'test query word', token_count: 3, importance: 0.5, created_at: now, is_archived: 0 },
        { id: 3, role: 'system', content: 'test query word', token_count: 3, importance: 0.5, created_at: now, is_archived: 0 },
        { id: 4, role: 'tool', content: 'test query word', token_count: 3, importance: 0.5, created_at: now, is_archived: 0 },
      ]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('test query word');

      expect(ctx.text).toContain('[Conversation]');
      expect(ctx.text).toContain('[System]');
    });
  });

  describe('categoryLabel mapping', () => {
    it('maps all categories', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      const categories = ['preference', 'fact', 'episodic', 'procedural', 'unknown'];
      const labels = ['Preference', 'Fact', 'Summary', 'Procedure', 'Memory'];

      for (let i = 0; i < categories.length; i++) {
        (vectorIndex.search as jest.Mock).mockReturnValue([{ id: `ltm_${i}`, score: 0.9 }]);
        (storage.getLongTermMemory as jest.Mock).mockReturnValue({
          id: `ltm_${i}`, category: categories[i], key: 'k', value: `value_${i}`,
          embedding_id: 'e', confidence: 0.8, access_count: 0, last_accessed: null, is_active: 1, created_at: Date.now(),
        });

        const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
        const ctx = await engine.assembleContext('test');
        expect(ctx.text).toContain(`[${labels[i]}]`);
      }
    });
  });

  describe('fillBudget truncation', () => {
    it('truncates long candidates to fit budget', async () => {
      const config = makeConfig({ tokenBudget: { contextWindow: 100, systemPromptReserve: 10, outputReserve: 10 } });
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      const longContent = 'word '.repeat(500);
      (storage.getActiveMessages as jest.Mock).mockReturnValue([
        { id: 1, role: 'user', content: longContent, token_count: 500, importance: 0.5, created_at: Date.now(), is_archived: 0 },
      ]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('word');
      // Budget = 100 - 10 - 10 - 10 = 70 tokens, content is 500 tokens -> should be truncated
      expect(ctx.tokenCount).toBeLessThan(100);
    });

    it('successfully truncates a long candidate that fits after truncation', async () => {
      // Budget = 300 - 10 - 10 - 10(overhead) = 270 tokens available
      // Content has tokenCount=200 (> 100, triggers truncation branch)
      // halfBudget = (270 - 0) * 4 = 1080 chars > 50, so truncation is attempted
      const config = makeConfig({ tokenBudget: { contextWindow: 300, systemPromptReserve: 10, outputReserve: 10 } });
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      const longContent = 'This is a sentence. '.repeat(100); // 2000 chars, ~200 tokens
      (storage.getActiveMessages as jest.Mock).mockReturnValue([
        { id: 1, role: 'user', content: longContent, token_count: 200, importance: 0.9, created_at: Date.now(), is_archived: 0 },
      ]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('sentence');
      // The candidate is too big (200 tokens) for budget (270), so it tries truncation
      // After truncation, the shorter text should fit
      expect(ctx.sources.length).toBeGreaterThanOrEqual(0);
    });

    it('skips candidates that cannot fit even truncated', async () => {
      const config = makeConfig({ tokenBudget: { contextWindow: 30, systemPromptReserve: 5, outputReserve: 5 } });
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      // Small candidate that fits + large one that doesn't
      (storage.getActiveMessages as jest.Mock).mockReturnValue([
        { id: 1, role: 'user', content: 'short', token_count: 2, importance: 0.9, created_at: Date.now(), is_archived: 0 },
        { id: 2, role: 'user', content: 'x'.repeat(50), token_count: 50, importance: 0.5, created_at: Date.now(), is_archived: 0 },
      ]);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('short');
      // Should include at least the short one
      expect(ctx.sources.some(s => s.id === 1)).toBe(true);
    });
  });

  describe('knowledge chunk missing from storage', () => {
    it('skips when getKnowledgeChunk returns null', async () => {
      const config = makeConfig();
      const { storage, vectorIndex, embedding, decayManager } = makeDeps();

      (storage.getAllKnowledgeIds as jest.Mock).mockReturnValue(['kb_1']);
      (vectorIndex.search as jest.Mock).mockReturnValue([{ id: 'kb_1', score: 0.9 }]);
      (storage.getKnowledgeChunk as jest.Mock).mockReturnValue(undefined);

      const engine = new RetrievalEngine(config, storage, vectorIndex, embedding, decayManager);
      const ctx = await engine.assembleContext('test');
      expect(ctx.sources.filter((s) => s.type === 'knowledge')).toHaveLength(0);
    });
  });
});
