import { describe, expect, it } from 'vitest';
import { checkHealth } from '../../src/modules/health/application/check-health';

describe('R3 health check', () => {
  it('is healthy when the database answers', async () => {
    expect(await checkHealth(async () => 1)).toEqual({ ok: true });
  });

  it('is unavailable when the database rejects, without leaking the reason', async () => {
    const result = await checkHealth(async () => {
      throw new Error('password authentication failed for user "x"');
    });
    expect(result).toEqual({ ok: false });
  });

  it('is unavailable when the database does not answer within the budget', async () => {
    const result = await checkHealth(() => new Promise(() => undefined), 20);
    expect(result).toEqual({ ok: false });
  });
});
