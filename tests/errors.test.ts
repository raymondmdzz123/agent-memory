import {
  MemoryError,
  MemoryClosedError,
  MemoryNotFoundError,
  MemoryCapacityError,
  EmbeddingError,
} from '../src/errors';

describe('MemoryError', () => {
  it('sets name and message', () => {
    const err = new MemoryError('test');
    expect(err.name).toBe('MemoryError');
    expect(err.message).toBe('test');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('MemoryClosedError', () => {
  it('sets name and default message', () => {
    const err = new MemoryClosedError();
    expect(err.name).toBe('MemoryClosedError');
    expect(err.message).toBe('Memory instance has been closed');
    expect(err).toBeInstanceOf(MemoryError);
  });
});

describe('MemoryNotFoundError', () => {
  it('includes the ID in the message', () => {
    const err = new MemoryNotFoundError('ltm_123');
    expect(err.name).toBe('MemoryNotFoundError');
    expect(err.message).toContain('ltm_123');
    expect(err).toBeInstanceOf(MemoryError);
  });
});

describe('MemoryCapacityError', () => {
  it('includes limit info in the message', () => {
    const err = new MemoryCapacityError('conversation messages', 500, 500);
    expect(err.name).toBe('MemoryCapacityError');
    expect(err.message).toContain('500/500');
    expect(err.message).toContain('conversation messages');
    expect(err).toBeInstanceOf(MemoryError);
  });
});

describe('EmbeddingError', () => {
  it('includes details in message', () => {
    const err = new EmbeddingError('timeout');
    expect(err.name).toBe('EmbeddingError');
    expect(err.message).toContain('timeout');
    expect(err).toBeInstanceOf(MemoryError);
  });
});
