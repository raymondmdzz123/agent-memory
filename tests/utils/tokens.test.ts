import { countTokens } from '../../src/utils/tokens';

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('returns 0 for falsy input', () => {
    expect(countTokens(undefined as any)).toBe(0);
    expect(countTokens(null as any)).toBe(0);
  });

  it('counts Latin text at ~4 chars per token', () => {
    // "hello" = 5 chars * 0.25 = 1.25 → ceil = 2
    expect(countTokens('hello')).toBe(2);
    // "ab" = 2 * 0.25 = 0.5 → ceil = 1
    expect(countTokens('ab')).toBe(1);
  });

  it('counts CJK characters at 1.5 tokens each', () => {
    // "你好" = 2 * 1.5 = 3
    expect(countTokens('你好')).toBe(3);
    // Single CJK char: 1.5 → ceil = 2
    expect(countTokens('中')).toBe(2);
  });

  it('handles mixed Latin and CJK text', () => {
    // "hi你好" = 2*0.25 + 2*1.5 = 0.5 + 3 = 3.5 → ceil = 4
    expect(countTokens('hi你好')).toBe(4);
  });

  it('handles CJK Extension A range', () => {
    // U+3400 is CJK Extension A
    expect(countTokens('\u3400')).toBe(2);
  });

  it('handles CJK Compatibility range', () => {
    // U+F900 is CJK Compat
    expect(countTokens('\uF900')).toBe(2);
  });

  it('handles CJK Punctuation range', () => {
    // U+3001 is ideographic comma
    expect(countTokens('\u3001')).toBe(2);
  });

  it('handles Fullwidth forms', () => {
    // U+FF01 = fullwidth exclamation
    expect(countTokens('\uFF01')).toBe(2);
  });
});
