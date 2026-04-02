import { createMemory, AgentMemoryImpl } from '../src/index';
import type { EmbeddingProvider } from '../src/types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('index.ts', () => {
  it('createMemory returns an AgentMemory instance', async () => {
    const dir = path.join(os.tmpdir(), `idx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const embedding: EmbeddingProvider = {
      dimensions: 4,
      embed: async () => [1, 0, 0, 0],
    };

    const mem = await createMemory({ dataDir: dir, embedding });
    expect(mem).toBeInstanceOf(AgentMemoryImpl);
    await mem.close();
    await new Promise((r) => setTimeout(r, 200));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('re-exports error classes', () => {
    const { MemoryError, MemoryClosedError, MemoryNotFoundError, MemoryCapacityError, EmbeddingError } = require('../src/index');
    expect(MemoryError).toBeDefined();
    expect(MemoryClosedError).toBeDefined();
    expect(MemoryNotFoundError).toBeDefined();
    expect(MemoryCapacityError).toBeDefined();
    expect(EmbeddingError).toBeDefined();
  });
});
