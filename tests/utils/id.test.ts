import { generateMemoryId, generateEmbeddingId } from '../../src/utils/id';

describe('generateMemoryId', () => {
  it('returns string starting with ltm_', () => {
    expect(generateMemoryId()).toMatch(/^ltm_\d+_[0-9a-f]{6}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateMemoryId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateEmbeddingId', () => {
  it('returns string starting with emb_', () => {
    expect(generateEmbeddingId()).toMatch(/^emb_\d+_[0-9a-f]{6}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEmbeddingId()));
    expect(ids.size).toBe(100);
  });
});
