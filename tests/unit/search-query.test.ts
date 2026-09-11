import { describe, expect, it } from 'vitest';
import { searchQuerySchema } from '../../src/modules/search/contracts/search.contract';

describe('S0 query boundary', () => {
  it('accepts a product name', () => {
    expect(searchQuerySchema.parse('баранина')).toBe('баранина');
  });
  it('trims surrounding whitespace', () => {
    expect(searchQuerySchema.parse('  баранина  ')).toBe('баранина');
  });
  it.each(['', '   ', '\t\n', undefined, null])('rejects an empty or missing query: %s', (query) => {
    expect(searchQuerySchema.safeParse(query).success).toBe(false);
  });
});
