import { describe, expect, it } from 'vitest';
import { testDatabaseUrl } from '../integration/database';

describe('test database isolation guard (no database connection)', () => {
  const development = 'postgresql://kaida:local@localhost:5432/kaida';
  const test = 'postgresql://kaida:local@localhost:5432/kaida_test';
  it('accepts separate development and test database names', () => {
    expect(testDatabaseUrl({ DATABASE_URL: development, TEST_DATABASE_URL: test })).toBe(test);
  });
  it.each([development, 'postgresql://kaida:local@localhost:5432/%6baida', 'postgresql://kaida:local@localhost:5432/other', 'https://localhost/kaida_test', undefined])('rejects unsafe test target: %s', (target) => {
    expect(() => testDatabaseUrl({ DATABASE_URL: development, TEST_DATABASE_URL: target })).toThrow();
  });
  it('rejects the test database being used as the development database', () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: test, TEST_DATABASE_URL: test })).toThrow();
  });
});
