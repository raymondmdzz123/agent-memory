import { extractByRules, extractByLLM } from '../../src/extraction/facts';

describe('extractByRules', () => {
  it('extracts English preferences (I like X)', () => {
    const facts = extractByRules('I like TypeScript.', 'Great choice!');
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts[0].category).toBe('preference');
    expect(facts[0].confidence).toBe(0.8);
  });

  it('extracts English preferences (I prefer X)', () => {
    const facts = extractByRules('I prefer dark mode.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts English preferences (I love X)', () => {
    const facts = extractByRules('I love React.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts English preferences (I enjoy X)', () => {
    const facts = extractByRules('I enjoy functional programming.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts English preferences (I use X)', () => {
    const facts = extractByRules('I use Vim.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts English preferences (I want X)', () => {
    const facts = extractByRules('I want a cleaner API.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts Chinese preferences (我喜欢X)', () => {
    const facts = extractByRules('我喜欢 TypeScript。', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts Chinese preferences (我偏好X)', () => {
    const facts = extractByRules('我偏好深色模式。', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts Chinese preferences (我习惯X)', () => {
    const facts = extractByRules('我习惯早起。', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts negative preferences (don\'t use X)', () => {
    const facts = extractByRules("Don't use jQuery.", 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts negative preferences (never use X)', () => {
    const facts = extractByRules('never use tabs.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts negative preferences (avoid X)', () => {
    const facts = extractByRules('avoid use of global variables.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts negative preferences (do not like X)', () => {
    const facts = extractByRules('do not like semicolons.', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts Chinese negative preferences (不要X)', () => {
    const facts = extractByRules('不要用 var。', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts Chinese negative preferences (别用X)', () => {
    const facts = extractByRules('别用全局变量。', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts Chinese negative preferences (不用X)', () => {
    const facts = extractByRules('不用 jQuery。', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts Chinese negative preferences (不喜欢X)', () => {
    const facts = extractByRules('不喜欢分号。', 'OK');
    expect(facts.some((f) => f.category === 'preference')).toBe(true);
  });

  it('extracts project facts (project uses X)', () => {
    const facts = extractByRules('Our project uses PostgreSQL.', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts facts (system adopts X)', () => {
    const facts = extractByRules('The system adopts microservices.', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts facts (we use X)', () => {
    const facts = extractByRules('We use Docker.', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts facts (app runs X)', () => {
    const facts = extractByRules('The app runs Node.js.', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts Chinese project facts (项目使用X)', () => {
    const facts = extractByRules('项目使用 PostgreSQL。', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts Chinese project facts (系统采用X)', () => {
    const facts = extractByRules('系统采用微服务架构。', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts Chinese project facts (应用用的是X)', () => {
    const facts = extractByRules('应用用的是 React。', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts user name (my name is X)', () => {
    const facts = extractByRules('My name is Alice.', 'Hi Alice!');
    expect(facts.some((f) => f.key === 'user_name')).toBe(true);
    expect(facts.find((f) => f.key === 'user_name')?.confidence).toBe(0.9);
  });

  it('extracts user name (call me X)', () => {
    const facts = extractByRules("Call me Bob.", 'OK Bob');
    expect(facts.some((f) => f.key === 'user_name')).toBe(true);
  });

  it('extracts Chinese user name (我叫X)', () => {
    const facts = extractByRules('我叫张三。', 'OK');
    expect(facts.some((f) => f.key === 'user_name')).toBe(true);
  });

  it('extracts Chinese user name (我是X)', () => {
    const facts = extractByRules('我是李四。', 'OK');
    expect(facts.some((f) => f.key === 'user_name')).toBe(true);
  });

  it('extracts Chinese user name (我的名字是X)', () => {
    const facts = extractByRules('我的名字是王五。', 'OK');
    expect(facts.some((f) => f.key === 'user_name')).toBe(true);
  });

  it('returns empty array for no matches', () => {
    const facts = extractByRules('What time is it?', 'It is 3 PM.');
    expect(facts).toEqual([]);
  });

  it('deduplicates facts with same category and key', () => {
    // Both messages contain "I like TypeScript" to trigger same extraction twice
    const facts = extractByRules(
      'I like TypeScript.',
      'I know you like TypeScript.',
    );
    // The regex matches "i like TypeScript" in combined text.
    // "I like TypeScript." from user + "I know you like TypeScript." from assistant
    // Both should match the "I like X" pattern, yielding same key.
    // Dedup should remove the duplicate.
    const tsPrefs = facts.filter((f) => f.key.includes('typescript'));
    expect(tsPrefs.length).toBeLessThanOrEqual(1);
  });

  it('dedup: returns second fact when it has a different key', () => {
    const facts = extractByRules(
      'I like TypeScript. I like Python.',
      'OK',
    );
    // Should produce 2 different preferences
    expect(facts.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts from assistant reply too', () => {
    const facts = extractByRules('OK', 'The project uses Redis.');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts I\'m called X', () => {
    const facts = extractByRules("I'm called Charlie.", 'OK');
    expect(facts.some((f) => f.key === 'user_name')).toBe(true);
  });

  it('extracts project used X (past tense)', () => {
    const facts = extractByRules('We used Terraform.', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });

  it('extracts application uses X', () => {
    const facts = extractByRules('The application uses GraphQL.', 'OK');
    expect(facts.some((f) => f.category === 'fact')).toBe(true);
  });
});

describe('extractByLLM', () => {
  it('returns empty array when llm is null', async () => {
    const result = await extractByLLM(null, 'Hello', 'Hi');
    expect(result).toEqual([]);
  });

  it('parses valid LLM JSON response', async () => {
    const mockLLM = {
      generate: jest.fn().mockResolvedValue(
        '[{"category":"preference","key":"lang","value":"TypeScript"}]',
      ),
    };
    const result = await extractByLLM(mockLLM, 'I prefer TS', 'Noted');
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('preference');
    expect(result[0].confidence).toBe(0.6);
  });

  it('handles LLM JSON with surrounding text', async () => {
    const mockLLM = {
      generate: jest.fn().mockResolvedValue(
        'Here is the result:\n[{"category":"fact","key":"db","value":"PostgreSQL"}]\nDone.',
      ),
    };
    const result = await extractByLLM(mockLLM, 'We use PG', 'OK');
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('fact');
  });

  it('returns empty array for no JSON in response', async () => {
    const mockLLM = {
      generate: jest.fn().mockResolvedValue('No facts found.'),
    };
    const result = await extractByLLM(mockLLM, 'Hello', 'Hi');
    expect(result).toEqual([]);
  });

  it('returns empty array on invalid JSON', async () => {
    const mockLLM = {
      generate: jest.fn().mockResolvedValue('[{invalid}]'),
    };
    const result = await extractByLLM(mockLLM, 'Hello', 'Hi');
    expect(result).toEqual([]);
  });

  it('returns empty array on LLM error', async () => {
    const mockLLM = {
      generate: jest.fn().mockRejectedValue(new Error('timeout')),
    };
    const result = await extractByLLM(mockLLM, 'Hello', 'Hi');
    expect(result).toEqual([]);
  });

  it('filters out items with missing fields', async () => {
    const mockLLM = {
      generate: jest.fn().mockResolvedValue(
        '[{"category":"fact","key":"valid","value":"yes"},{"category":"","key":"","value":""}]',
      ),
    };
    const result = await extractByLLM(mockLLM, 'test', 'test');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('valid');
  });

  it('returns empty array for empty LLM response array', async () => {
    const mockLLM = { generate: jest.fn().mockResolvedValue('[]') };
    const result = await extractByLLM(mockLLM, 'Hello', 'Hi');
    expect(result).toEqual([]);
  });
});
