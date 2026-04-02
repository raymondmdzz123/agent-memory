import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { VectorIndex } from '../../src/vector/hnsw';

function tmpDir(): string {
  return path.join(os.tmpdir(), `vec-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('VectorIndex', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('initializes fresh index, add/search/remove', async () => {
    const vi = new VectorIndex(dir, 4, 100);
    await vi.initialize();

    expect(vi.getSize()).toBe(0);

    // Add vectors
    vi.add('a', [1, 0, 0, 0]);
    vi.add('b', [0, 1, 0, 0]);
    vi.add('c', [0, 0, 1, 0]);
    expect(vi.getSize()).toBe(3);

    // Search
    const results = vi.search([1, 0, 0, 0], 2);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('a');
    expect(results[0].score).toBeCloseTo(1.0, 1);

    // Remove
    vi.remove('a');
    expect(vi.getSize()).toBe(2);

    // Search after removal
    const results2 = vi.search([1, 0, 0, 0], 5);
    expect(results2.every((r) => r.id !== 'a')).toBe(true);

    vi.close();
  });

  it('update existing id', async () => {
    const vi = new VectorIndex(dir, 4, 100);
    await vi.initialize();

    vi.add('a', [1, 0, 0, 0]);
    vi.add('a', [0, 1, 0, 0]); // update
    expect(vi.getSize()).toBe(1);

    const results = vi.search([0, 1, 0, 0], 1);
    expect(results[0].id).toBe('a');
    expect(results[0].score).toBeCloseTo(1.0, 1);

    vi.close();
  });

  it('returns empty for search on empty index', async () => {
    const vi = new VectorIndex(dir, 4, 100);
    await vi.initialize();

    const results = vi.search([1, 0, 0, 0], 5);
    expect(results).toEqual([]);

    vi.close();
  });

  it('persists and restores from disk', async () => {
    const vi = new VectorIndex(dir, 4, 100);
    await vi.initialize();

    vi.add('a', [1, 0, 0, 0]);
    vi.add('b', [0, 1, 0, 0]);
    vi.save();
    vi.close();

    // Re-open
    const vi2 = new VectorIndex(dir, 4, 100);
    await vi2.initialize();
    expect(vi2.getSize()).toBe(2);

    const results = vi2.search([1, 0, 0, 0], 1);
    expect(results[0].id).toBe('a');

    vi2.close();
  });

  it('auto-resizes when exceeding maxElements', async () => {
    const vi = new VectorIndex(dir, 4, 2); // max 2
    await vi.initialize();

    vi.add('a', [1, 0, 0, 0]);
    vi.add('b', [0, 1, 0, 0]);
    // Should trigger resize
    vi.add('c', [0, 0, 1, 0]);
    expect(vi.getSize()).toBe(3);

    vi.close();
  });

  it('getIndexFileSize returns 0 before save', async () => {
    const vi = new VectorIndex(dir, 4, 100);
    await vi.initialize();
    // Before adding anything, no index.bin yet
    expect(vi.getIndexFileSize()).toBe(0);
    vi.close();
  });

  it('getIndexFileSize returns positive after save', async () => {
    const vi = new VectorIndex(dir, 4, 100);
    await vi.initialize();
    vi.add('a', [1, 0, 0, 0]);
    vi.save();
    expect(vi.getIndexFileSize()).toBeGreaterThan(0);
    vi.close();
  });

  it('remove on non-existent id is a no-op', async () => {
    const vi = new VectorIndex(dir, 4, 100);
    await vi.initialize();
    vi.remove('does-not-exist'); // should not throw
    vi.close();
  });

  it('close on uninitialized does nothing', () => {
    const vi = new VectorIndex(dir, 4, 100);
    vi.close(); // should not throw
  });

  it('save on uninitialized does nothing', () => {
    const vi = new VectorIndex(dir, 4, 100);
    vi.save(); // should not throw
  });

  it('throws on add if not initialized', () => {
    const vi = new VectorIndex(dir, 4, 100);
    expect(() => vi.add('a', [1, 0, 0, 0])).toThrow('VectorIndex not initialized');
  });

  it('throws on remove if not initialized', () => {
    const vi = new VectorIndex(dir, 4, 100);
    expect(() => vi.remove('a')).toThrow('VectorIndex not initialized');
  });

  it('throws on search if not initialized', () => {
    const vi = new VectorIndex(dir, 4, 100);
    expect(() => vi.search([1, 0, 0, 0], 1)).toThrow('VectorIndex not initialized');
  });
});
