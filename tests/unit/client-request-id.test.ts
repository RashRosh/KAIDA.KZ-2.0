import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { clientRequestId } from '../../src/app/_components/client-request-id';

// The text list's request id on a plain-http stand (no secure context → no crypto.randomUUID): found on the
// text-availability acceptance stand, where «Разобрать в черновики» did nothing.
describe('clientRequestId', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses crypto.randomUUID when the page has it', () => {
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    expect(clientRequestId()).toBe('00000000-0000-4000-8000-000000000001');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('without crypto.randomUUID still returns distinct v4 UUIDs the API accepts', () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const ids = [clientRequestId(), clientRequestId()];
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(z.uuid().safeParse(id).success).toBe(true);
      }
      expect(ids[0]).not.toBe(ids[1]);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});
