import { describe, expect, it, vi } from 'vitest';
import { createRoadDistanceResolver } from '../../src/modules/geo/road-distances';

const config = {
  baseUrl: new URL('http://127.0.0.1:5000/'), graphVersion: 'test-graph',
  maxDestinations: 2, maxConcurrent: 1, timeoutMs: 25, maxSnapMeters: 50, cacheMs: 1000,
};
const buyer = { longitude: 76.945093, latitude: 43.246272 };
const bazaar = { locationId: 'bazaar', point: { longitude: 76.955077, latitude: 43.263577 } };
const globus = { locationId: 'globus', point: { longitude: 76.905733, latitude: 43.240381 } };
const matrix = {
  code: 'Ok', distances: [[3946.3, 3696.1]], sources: [{ distance: 3 }],
  destinations: [{ distance: 25 }, { distance: 38 }],
};

describe('OSRM distances', () => {
  it('uses one matrix for duplicate points and shares in-flight and cached results', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(matrix));
    const resolve = createRoadDistanceResolver(config, request);
    const [first, second] = await Promise.all([
      resolve(buyer, [bazaar, globus, bazaar]),
      resolve(buyer, [globus, bazaar]),
    ]);

    expect(first).toEqual(new Map([[bazaar.locationId, 3946], [globus.locationId, 3696]]));
    expect(second).toEqual(first);
    await expect(resolve(buyer, [globus, bazaar])).resolves.toEqual(first);
    expect(request).toHaveBeenCalledTimes(1);
    const url = new URL(String(request.mock.calls[0][0]));
    expect(url.pathname).toBe('/table/v1/driving/76.945093,43.246272;76.955077,43.263577;76.905733,43.240381');
    expect(url.searchParams.get('sources')).toBe('0');
    expect(url.searchParams.get('destinations')).toBe('1;2');
    expect(url.searchParams.get('annotations')).toBe('distance');
    expect(url.searchParams.has('fallback_speed')).toBe(false);
    expect(request.mock.calls[0][1]).toMatchObject({ cache: 'no-store', redirect: 'error' });
  });

  it('keeps a changed buyer origin or a changed point separate from cached results', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(matrix));
    const resolve = createRoadDistanceResolver(config, request);
    const first = await resolve(buyer, [bazaar, globus]);
    request.mockImplementation(async () => Response.json({ ...matrix, distances: [[5010, 1110]] }));
    await expect(resolve({ ...buyer, longitude: 76.903 }, [bazaar, globus]))
      .resolves.toEqual(new Map([['bazaar', 5010], ['globus', 1110]]));
    await expect(resolve(buyer, [{ ...bazaar, point: { ...bazaar.point, latitude: 43.26 } }, globus]))
      .resolves.toEqual(new Map([['bazaar', 5010], ['globus', 1110]]));
    await expect(resolve(buyer, [bazaar, globus])).resolves.toEqual(first);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['one missing route', { ...matrix, distances: [[3946, null]] }],
    ['short row', { ...matrix, distances: [[3946]] }],
    ['missing waypoint', { ...matrix, destinations: [{ distance: 0 }] }],
    ['origin snapped too far', { ...matrix, sources: [{ distance: 51 }] }],
    ['destination snapped too far', { ...matrix, destinations: [{ distance: 0 }, { distance: 51 }] }],
    ['estimated distance', { ...matrix, fallback_speed_cells: [[0, 1]] }],
  ])('falls back for %s', async (_, body) => {
    const resolve = createRoadDistanceResolver(config, async () => Response.json(body));
    await expect(resolve(buyer, [bazaar, globus])).resolves.toBeNull();
  });

  it('falls back on HTTP failure, malformed JSON and network rejection', async () => {
    for (const request of [
      async () => new Response(null, { status: 503 }),
      async () => new Response('<html>'),
      async () => { throw new Error('network unavailable'); },
    ]) {
      await expect(createRoadDistanceResolver(config, request)(buyer, [bazaar])).resolves.toBeNull();
    }
  });

  it('bounds concurrent matrices, deadlines, invalid coordinates and destination count', async () => {
    const request = vi.fn<typeof fetch>((_, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('deadline')), { once: true });
    }));
    const resolve = createRoadDistanceResolver(config, request);
    const active = resolve(buyer, [bazaar, globus]);
    await expect(resolve({ ...buyer, longitude: 77 }, [bazaar])).resolves.toBeNull();
    await expect(resolve(buyer, [bazaar, globus, { ...globus, locationId: 'third' }])).resolves.toBeNull();
    await expect(resolve({ ...buyer, longitude: 181 }, [bazaar])).resolves.toBeNull();
    await expect(active).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
