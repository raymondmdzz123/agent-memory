import { KnowledgeBase } from '../../src/knowledge/base';
import type { KnowledgeChunkRow, EmbeddingProvider } from '../../src/types';
import type { SqliteStorage } from '../../src/storage/sqlite';
import type { VectorIndex } from '../../src/vector/hnsw';
import type { AuditLogger } from '../../src/audit/logger';

function makeMocks() {
  const storage = {
    insertKnowledgeChunk: jest.fn(),
    getKnowledgeChunk: jest.fn(),
    listKnowledgeChunks: jest.fn().mockReturnValue([]),
    deleteKnowledgeChunk: jest.fn(),
    deleteKnowledgeBySource: jest.fn().mockReturnValue([]),
    getAllKnowledgeIds: jest.fn().mockReturnValue([]),
  } as unknown as jest.Mocked<SqliteStorage>;

  const vectorIndex = {
    add: jest.fn(),
    remove: jest.fn(),
    search: jest.fn().mockReturnValue([]),
  } as unknown as jest.Mocked<VectorIndex>;

  const embedding: jest.Mocked<EmbeddingProvider> = {
    dimensions: 4,
    embed: jest.fn().mockResolvedValue([1, 0, 0, 0]),
  };

  const audit = {
    log: jest.fn(),
  } as unknown as jest.Mocked<AuditLogger>;

  return { storage, vectorIndex, embedding, audit };
}

describe('KnowledgeBase', () => {
  describe('add', () => {
    it('adds a chunk, writes to storage and vector index', async () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const id = await kb.add('docs', 'Getting Started', 'Some content here');
      expect(id).toMatch(/^kb_/);
      expect(storage.insertKnowledgeChunk).toHaveBeenCalledTimes(1);
      const row: KnowledgeChunkRow = storage.insertKnowledgeChunk.mock.calls[0][0];
      expect(row.source).toBe('docs');
      expect(row.title).toBe('Getting Started');
      expect(row.content).toBe('Some content here');

      expect(embedding.embed).toHaveBeenCalledWith('Getting Started\nSome content here');
      expect(vectorIndex.add).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalled();
    });

    it('sanitizes content and logs warnings', async () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      // Content with a secret pattern
      await kb.add('docs', 'Title', 'my api_key: sk_live_abcdefgh12345678');
      // Should have been sanitized
      const row: KnowledgeChunkRow = storage.insertKnowledgeChunk.mock.calls[0][0];
      expect(row.content).toContain('[REDACTED]');
      // Audit should be called for sanitization warning + the normal save log
      const logCalls = audit.log.mock.calls.map((c: any) => c[0]);
      expect(logCalls.some((c: any) => c.details?.includes('sanitization'))).toBe(true);
    });

    it('passes metadata through', async () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      await kb.add('docs', 'T', 'C', { version: 2 });
      const row: KnowledgeChunkRow = storage.insertKnowledgeChunk.mock.calls[0][0];
      expect(JSON.parse(row.metadata!)).toEqual({ version: 2 });
    });
  });

  describe('addBatch', () => {
    it('adds multiple chunks', async () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const ids = await kb.addBatch([
        { source: 'a', title: 'T1', content: 'C1' },
        { source: 'b', title: 'T2', content: 'C2' },
      ]);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toMatch(/^kb_/);
      expect(storage.insertKnowledgeChunk).toHaveBeenCalledTimes(2);
    });
  });

  describe('remove', () => {
    it('removes chunk from storage and vector index', () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (storage.deleteKnowledgeChunk as jest.Mock).mockReturnValue('kb_emb_1');
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      kb.remove('kb_1');
      expect(storage.deleteKnowledgeChunk).toHaveBeenCalledWith('kb_1');
      expect(vectorIndex.remove).toHaveBeenCalledWith('kb_1');
      expect(audit.log).toHaveBeenCalled();
    });

    it('does nothing if chunk not found', () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (storage.deleteKnowledgeChunk as jest.Mock).mockReturnValue(undefined);
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      kb.remove('nope');
      expect(vectorIndex.remove).not.toHaveBeenCalled();
    });
  });

  describe('removeBySource', () => {
    it('removes all chunks for a source', () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (storage.deleteKnowledgeBySource as jest.Mock).mockReturnValue([
        { id: 'kb_1', source: 'docs', title: 't', content: 'c', embedding_id: 'e', token_count: 1, metadata: null, created_at: 0 },
        { id: 'kb_2', source: 'docs', title: 't', content: 'c', embedding_id: 'e', token_count: 1, metadata: null, created_at: 0 },
      ]);
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const count = kb.removeBySource('docs');
      expect(count).toBe(2);
      expect(vectorIndex.remove).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalled();
    });

    it('returns 0 for empty source', () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (storage.deleteKnowledgeBySource as jest.Mock).mockReturnValue([]);
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      expect(kb.removeBySource('nope')).toBe(0);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns mapped chunks', () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (storage.listKnowledgeChunks as jest.Mock).mockReturnValue([
        { id: 'kb_1', source: 'docs', title: 'T', content: 'C', embedding_id: 'e', token_count: 3, metadata: '{"v":1}', created_at: 1000 },
      ]);
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const items = kb.list('docs');
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('kb_1');
      expect(items[0].tokenCount).toBe(3);
      expect(items[0].metadata).toEqual({ v: 1 });
    });

    it('returns chunks without metadata', () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (storage.listKnowledgeChunks as jest.Mock).mockReturnValue([
        { id: 'kb_1', source: 'docs', title: 'T', content: 'C', embedding_id: 'e', token_count: 3, metadata: null, created_at: 1000 },
      ]);
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const items = kb.list();
      expect(items[0].metadata).toBeUndefined();
    });
  });

  describe('search', () => {
    it('returns scored knowledge chunks', async () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (vectorIndex.search as jest.Mock).mockReturnValue([
        { id: 'kb_1', score: 0.9 },
        { id: 'ltm_1', score: 0.8 }, // not a KB chunk
      ]);
      (storage.getKnowledgeChunk as jest.Mock).mockImplementation((id: string) => {
        if (id === 'kb_1') {
          return { id: 'kb_1', source: 'docs', title: 'T', content: 'C', embedding_id: 'e', token_count: 2, metadata: null, created_at: 1000 };
        }
        return undefined; // ltm_1 not found
      });
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const results = await kb.search('query', 5);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('kb_1');
      expect(results[0].score).toBe(0.9);
    });

    it('respects topK limit', async () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (vectorIndex.search as jest.Mock).mockReturnValue([
        { id: 'kb_1', score: 0.9 },
        { id: 'kb_2', score: 0.8 },
        { id: 'kb_3', score: 0.7 },
      ]);
      (storage.getKnowledgeChunk as jest.Mock).mockImplementation((id: string) => ({
        id, source: 'docs', title: 'T', content: 'C', embedding_id: 'e', token_count: 2, metadata: null, created_at: 1000,
      }));
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const results = await kb.search('query', 2);
      expect(results).toHaveLength(2);
      // Verify that the loop broke at topK=2 and didn't return the 3rd item
      expect(results[0].id).toBe('kb_1');
      expect(results[1].id).toBe('kb_2');
    });

    it('breaks early when topK is reached', async () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      // Return more results than topK
      const searchResults: Array<{ id: string; score: number }> = [];
      for (let i = 0; i < 10; i++) {
        searchResults.push({ id: `kb_${i}`, score: 0.9 - i * 0.01 });
      }
      (vectorIndex.search as jest.Mock).mockReturnValue(searchResults);
      (storage.getKnowledgeChunk as jest.Mock).mockImplementation((id: string) => ({
        id, source: 'docs', title: 'T', content: 'Content', embedding_id: 'e', token_count: 2, metadata: null, created_at: 1000,
      }));
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      // Request only 3 — should break after 3
      const results = await kb.search('query', 3);
      expect(results).toHaveLength(3);
    });
  });

  describe('getAllIds', () => {
    it('returns set of ids', () => {
      const { storage, vectorIndex, embedding, audit } = makeMocks();
      (storage.getAllKnowledgeIds as jest.Mock).mockReturnValue(['kb_1', 'kb_2']);
      const kb = new KnowledgeBase(storage, vectorIndex, embedding, audit);

      const ids = kb.getAllIds();
      expect(ids).toBeInstanceOf(Set);
      expect(ids.size).toBe(2);
    });
  });
});
