import { getToolDefinitions, resolveToolCall } from '../../src/tools/definitions';

describe('getToolDefinitions', () => {
  it('returns OpenAI format tools', () => {
    const tools = getToolDefinitions('openai');
    expect(tools.length).toBe(7);
    const first = tools[0] as any;
    expect(first.type).toBe('function');
    expect(first.function.name).toBe('memory_search');
    expect(first.function.parameters.type).toBe('object');
    expect(first.function.parameters.additionalProperties).toBe(false);
  });

  it('returns Anthropic format tools', () => {
    const tools = getToolDefinitions('anthropic');
    expect(tools.length).toBe(7);
    const first = tools[0] as any;
    expect(first.name).toBe('memory_search');
    expect(first.input_schema.type).toBe('object');
    expect(first.input_schema.additionalProperties).toBe(false);
  });

  it('returns LangChain format tools', () => {
    const tools = getToolDefinitions('langchain');
    expect(tools.length).toBe(7);
    const first = tools[0] as any;
    expect(first.name).toBe('memory_search');
    expect(first.schema.type).toBe('object');
    expect(first.schema.additionalProperties).toBe(false);
  });

  it('falls back to OpenAI format for unknown format', () => {
    const tools = getToolDefinitions('unknown' as any);
    const first = tools[0] as any;
    expect(first.type).toBe('function');
  });

  it('all tools have description', () => {
    const tools = getToolDefinitions('openai');
    for (const t of tools as any[]) {
      expect(t.function.description).toBeTruthy();
    }
  });

  it('has correct required fields in memory_save', () => {
    const tools = getToolDefinitions('openai');
    const save = (tools as any[]).find((t) => t.function.name === 'memory_save');
    expect(save.function.parameters.required).toEqual(['category', 'key', 'value']);
  });

  it('memory_list has no required fields', () => {
    const tools = getToolDefinitions('openai');
    const list = (tools as any[]).find((t) => t.function.name === 'memory_list');
    expect(list.function.parameters.required).toBeUndefined();
  });

  it('memory_get_history has no required fields', () => {
    const tools = getToolDefinitions('openai');
    const hist = (tools as any[]).find((t) => t.function.name === 'memory_get_history');
    expect(hist.function.parameters.required).toBeUndefined();
  });

  it('knowledge_read is included', () => {
    const tools = getToolDefinitions('openai');
    const kr = (tools as any[]).find((t) => t.function.name === 'knowledge_read');
    expect(kr).toBeDefined();
    expect(kr.function.parameters.required).toEqual(['id']);
  });

  it('knowledge_search is included', () => {
    const tools = getToolDefinitions('openai');
    const ks = (tools as any[]).find((t) => t.function.name === 'knowledge_search');
    expect(ks).toBeDefined();
    expect(ks.function.parameters.required).toEqual(['query']);
  });
});

describe('resolveToolCall', () => {
  it('resolves known tool', () => {
    const spec = resolveToolCall('memory_search');
    expect(spec).toBeDefined();
    expect(spec!.name).toBe('memory_search');
  });

  it('returns undefined for unknown tool', () => {
    expect(resolveToolCall('nonexistent')).toBeUndefined();
  });

  it('resolves all 7 tools', () => {
    const names = [
      'memory_search', 'memory_save', 'memory_list', 'memory_delete',
      'memory_get_history', 'knowledge_read', 'knowledge_search',
    ];
    for (const name of names) {
      expect(resolveToolCall(name)).toBeDefined();
    }
  });
});
