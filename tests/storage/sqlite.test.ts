import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { SqliteStorage } from '../../src/storage/sqlite';
import type { LongTermMemoryRow, KnowledgeChunkRow } from '../../src/types';

function tmpDir(): string {
  const dir = path.join(os.tmpdir(), `mem-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return dir;
}

afterAll(() => {
  // cleanup handled per test
});

describe('SqliteStorage', () => {
  let dir: string;
  let storage: SqliteStorage;

  beforeEach(() => {
    dir = tmpDir();
    storage = new SqliteStorage(dir);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ------- Conversation -------

  describe('insertMessage / getActiveMessages', () => {
    it('inserts and retrieves messages', () => {
      const id1 = storage.insertMessage('default', 'user', 'Hello', 3);
      const id2 = storage.insertMessage('default', 'assistant', 'Hi there', 5, { tool: 'x' });
      expect(typeof id1).toBe('number');
      expect(id2).toBeGreaterThan(id1);

      const msgs = storage.getActiveMessages();
      expect(msgs).toHaveLength(2);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('Hello');
      expect(msgs[1].content).toBe('Hi there');
      expect(msgs[1].metadata).toBe(JSON.stringify({ tool: 'x' }));
    });

    it('respects limit', () => {
      storage.insertMessage('default', 'user', 'a', 1);
      storage.insertMessage('default', 'user', 'b', 1);
      storage.insertMessage('default', 'user', 'c', 1);
      const msgs = storage.getActiveMessages(undefined, 2);
      expect(msgs).toHaveLength(2);
    });
  });

  describe('getAllMessages', () => {
    it('returns paginated results', () => {
      for (let i = 0; i < 5; i++) storage.insertMessage('default', 'user', `msg${i}`, 1);
      const page1 = storage.getAllMessages(0, 2);
      expect(page1).toHaveLength(2);
      expect(page1[0].content).toBe('msg0');
      const page2 = storage.getAllMessages(2, 2);
      expect(page2).toHaveLength(2);
      expect(page2[0].content).toBe('msg2');
    });
  });

  describe('getArchiveCandidates / markArchived', () => {
    it('returns candidates before timestamp', () => {
      storage.insertMessage('default', 'user', 'old', 1);
      const candidates = storage.getArchiveCandidates(Date.now() + 1000, 10);
      expect(candidates).toHaveLength(1);
    });

    it('marks messages archived', () => {
      const id1 = storage.insertMessage('default', 'user', 'a', 1);
      const id2 = storage.insertMessage('default', 'user', 'b', 1);
      storage.markArchived([id1, id2], 'ltm_123', 'summary text');

      const active = storage.getActiveMessages();
      expect(active).toHaveLength(0);
    });
  });

  describe('countActiveMessages / countArchivedMessages', () => {
    it('counts correctly', () => {
      const id1 = storage.insertMessage('default', 'user', 'a', 1);
      storage.insertMessage('default', 'user', 'b', 1);
      expect(storage.countActiveMessages()).toBe(2);
      expect(storage.countArchivedMessages()).toBe(0);

      storage.markArchived([id1], 'ltm_1', null);
      expect(storage.countActiveMessages()).toBe(1);
      expect(storage.countArchivedMessages()).toBe(1);
    });
  });

  describe('getLatestMessageTime', () => {
    it('returns null when no messages', () => {
      expect(storage.getLatestMessageTime()).toBeNull();
    });

    it('returns latest timestamp', () => {
      storage.insertMessage('default', 'user', 'x', 1);
      const t = storage.getLatestMessageTime();
      expect(t).toBeGreaterThan(0);
    });
  });

  // ------- Long-term Memory -------

  describe('long-term memory CRUD', () => {
    const makeLtm = (id: string, isActive = 1): LongTermMemoryRow => ({
      id,
      category: 'fact',
      key: 'test_key',
      value: 'test_value',
      embedding_id: `emb_${id}`,
      confidence: 0.8,
      access_count: 0,
      last_accessed: null,
      is_active: isActive,
      created_at: Date.now(),
    });

    it('inserts and retrieves', () => {
      const row = makeLtm('ltm_1');
      storage.insertLongTermMemory(row);
      const got = storage.getLongTermMemory('ltm_1');
      expect(got).toBeDefined();
      expect(got!.id).toBe('ltm_1');
      expect(got!.category).toBe('fact');
    });

    it('returns undefined for missing id', () => {
      expect(storage.getLongTermMemory('nope')).toBeUndefined();
    });

    it('lists with filters', () => {
      storage.insertLongTermMemory(makeLtm('ltm_1'));
      storage.insertLongTermMemory({ ...makeLtm('ltm_2'), category: 'preference' });
      storage.insertLongTermMemory({ ...makeLtm('ltm_3'), is_active: 0 });

      const all = storage.listLongTermMemories();
      expect(all).toHaveLength(3);

      const facts = storage.listLongTermMemories({ category: 'fact' });
      expect(facts).toHaveLength(2); // ltm_1 + ltm_3 (both category 'fact')

      const active = storage.listLongTermMemories({ isActive: 1 });
      expect(active).toHaveLength(2);

      const inactive = storage.listLongTermMemories({ isActive: 0 });
      expect(inactive).toHaveLength(1);
    });

    it('filters by createdAfter / createdBefore', () => {
      const now = Date.now();
      storage.insertLongTermMemory({ ...makeLtm('ltm_1'), created_at: now - 5000 });
      storage.insertLongTermMemory({ ...makeLtm('ltm_2'), created_at: now });

      const after = storage.listLongTermMemories({ createdAfter: now - 3000 });
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe('ltm_2');

      const before = storage.listLongTermMemories({ createdBefore: now - 3000 });
      expect(before).toHaveLength(1);
      expect(before[0].id).toBe('ltm_1');
    });

    it('softDeleteMemory and refreshAccess', () => {
      storage.insertLongTermMemory(makeLtm('ltm_1'));
      storage.refreshAccess('ltm_1');
      let row = storage.getLongTermMemory('ltm_1')!;
      expect(row.access_count).toBe(1);
      expect(row.last_accessed).toBeGreaterThan(0);

      storage.softDeleteMemory('ltm_1');
      row = storage.getLongTermMemory('ltm_1')!;
      expect(row.is_active).toBe(0);
    });

    it('getActiveLongTermMemoryIds', () => {
      storage.insertLongTermMemory(makeLtm('ltm_1'));
      storage.insertLongTermMemory({ ...makeLtm('ltm_2'), is_active: 0 });
      const ids = storage.getActiveLongTermMemoryIds();
      expect(ids).toEqual(['ltm_1']);
    });

    it('countLongTermByStatus', () => {
      storage.insertLongTermMemory(makeLtm('ltm_1'));
      storage.insertLongTermMemory({ ...makeLtm('ltm_2'), is_active: 0 });
      const counts = storage.countLongTermByStatus();
      expect(counts.active).toBe(1);
      expect(counts.deleted).toBe(1);
      expect(counts.dormant).toBe(0); // always 0 here
    });

    it('findDormantCandidates', () => {
      const old = Date.now() - 200 * 24 * 3600 * 1000;
      storage.insertLongTermMemory({ ...makeLtm('ltm_old'), created_at: old });
      storage.insertLongTermMemory(makeLtm('ltm_new'));

      const candidates = storage.findDormantCandidates(Date.now() - 90 * 24 * 3600 * 1000);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('ltm_old');
    });

    it('purgeDeleted', () => {
      storage.insertLongTermMemory(makeLtm('ltm_1'));
      storage.insertLongTermMemory({ ...makeLtm('ltm_2'), is_active: 0 });
      const count = storage.purgeDeleted();
      expect(count).toBe(1);
      expect(storage.getLongTermMemory('ltm_2')).toBeUndefined();
    });
  });

  // ------- Knowledge Base -------

  describe('knowledge chunks', () => {
    const makeKb = (id: string, source = 'docs'): KnowledgeChunkRow => ({
      id,
      source,
      title: 'Test',
      content: 'Test content',
      embedding_id: `kb_${id}`,
      token_count: 5,
      metadata: null,
      created_at: Date.now(),
    });

    it('insert and get', () => {
      storage.insertKnowledgeChunk(makeKb('kb_1'));
      const got = storage.getKnowledgeChunk('kb_1');
      expect(got).toBeDefined();
      expect(got!.title).toBe('Test');
    });

    it('returns undefined for missing', () => {
      expect(storage.getKnowledgeChunk('nope')).toBeUndefined();
    });

    it('listKnowledgeChunks with and without source filter', () => {
      storage.insertKnowledgeChunk(makeKb('kb_1', 'docs'));
      storage.insertKnowledgeChunk(makeKb('kb_2', 'faq'));
      expect(storage.listKnowledgeChunks()).toHaveLength(2);
      expect(storage.listKnowledgeChunks('docs')).toHaveLength(1);
    });

    it('deleteKnowledgeChunk', () => {
      storage.insertKnowledgeChunk(makeKb('kb_1'));
      const embId = storage.deleteKnowledgeChunk('kb_1');
      expect(embId).toBe('kb_kb_1');
      expect(storage.getKnowledgeChunk('kb_1')).toBeUndefined();
    });

    it('deleteKnowledgeChunk returns undefined for missing', () => {
      expect(storage.deleteKnowledgeChunk('nope')).toBeUndefined();
    });

    it('deleteKnowledgeBySource', () => {
      storage.insertKnowledgeChunk(makeKb('kb_1', 'docs'));
      storage.insertKnowledgeChunk(makeKb('kb_2', 'docs'));
      storage.insertKnowledgeChunk(makeKb('kb_3', 'faq'));
      const deleted = storage.deleteKnowledgeBySource('docs');
      expect(deleted).toHaveLength(2);
      expect(storage.listKnowledgeChunks()).toHaveLength(1);
    });

    it('countKnowledgeChunks / countKnowledgeSources', () => {
      storage.insertKnowledgeChunk(makeKb('kb_1', 'docs'));
      storage.insertKnowledgeChunk(makeKb('kb_2', 'faq'));
      expect(storage.countKnowledgeChunks()).toBe(2);
      expect(storage.countKnowledgeSources()).toBe(2);
    });

    it('getAllKnowledgeIds', () => {
      storage.insertKnowledgeChunk(makeKb('kb_1'));
      storage.insertKnowledgeChunk(makeKb('kb_2'));
      const ids = storage.getAllKnowledgeIds();
      expect(ids.sort()).toEqual(['kb_1', 'kb_2']);
    });
  });

  // ------- Misc -------

  describe('getDbSize', () => {
    it('returns positive size', () => {
      storage.insertMessage('default', 'user', 'hi', 1);
      expect(storage.getDbSize()).toBeGreaterThan(0);
    });
  });

  describe('exportAll / importAll', () => {
    it('round-trips data', () => {
      storage.insertMessage('default', 'user', 'hello', 3);
      storage.insertLongTermMemory({
        id: 'ltm_x', category: 'fact', key: 'k', value: 'v',
        embedding_id: 'e', confidence: 0.7, access_count: 0,
        last_accessed: null, is_active: 1, created_at: Date.now(),
      });
      storage.insertKnowledgeChunk({
        id: 'kb_x', source: 's', title: 't', content: 'c',
        embedding_id: 'ke', token_count: 2, metadata: null, created_at: Date.now(),
      });

      const exported = storage.exportAll();
      expect(exported.conversations).toHaveLength(1);
      expect(exported.longTermMemories).toHaveLength(1);
      expect(exported.knowledgeChunks).toHaveLength(1);

      // Import into same storage (clears and re-inserts)
      storage.importAll(exported.conversations, exported.longTermMemories, exported.knowledgeChunks);
      const exported2 = storage.exportAll();
      expect(exported2.conversations).toHaveLength(1);
      expect(exported2.longTermMemories).toHaveLength(1);
      expect(exported2.knowledgeChunks).toHaveLength(1);
    });

    it('importAll with empty knowledgeChunks', () => {
      storage.importAll([], [], []);
      const ex = storage.exportAll();
      expect(ex.conversations).toHaveLength(0);
    });
  });
});
