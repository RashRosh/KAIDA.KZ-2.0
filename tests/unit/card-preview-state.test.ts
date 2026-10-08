import { describe, expect, it } from 'vitest';
import { cardPreviewBodySchema } from '../../src/modules/seller-input/contracts/card-preview.contract';
import { emptyCardValues, previewAvailability, previewBody, type CardValues } from '../../src/app/seller/_components/card-editor-state';

// pre-publication-buyer-preview §3.2 / §3.8 (unit): when the preview is available and what the request carries.

function values(patch: Partial<CardValues> = {}): CardValues {
  return {
    ...emptyCardValues(),
    title: 'Помидоры',
    amount: '1 200',
    unit: { code: 'kg', custom: '' },
    points: { [LA]: { selected: true, ownPrice: null } },
    ...patch,
  };
}
const LA = '00000000-0000-4000-8000-0000000000a1';
const LB = '00000000-0000-4000-8000-0000000000a2';
const LC = '00000000-0000-4000-8000-0000000000a3';
const LZ = '00000000-0000-4000-8000-0000000000a4';
const O1 = '00000000-0000-4000-8000-0000000000b1';
const O2 = '00000000-0000-4000-8000-0000000000b2';
const P1 = '00000000-0000-4000-8000-0000000000c1';
const idle = { activePoints: 0, uploading: false };

describe('previewAvailability', () => {
  it('is available with a valid title, a valid price and one point; unit, pack, comment and photos are optional', () => {
    expect(previewAvailability(values({ unit: { code: '', custom: '' } }), 'create', idle)).toEqual({ ok: true, reasons: [] });
  });

  it('asks for title and price, a point, and a finished upload — each with its own reason', () => {
    expect(previewAvailability(values({ title: ' ' }), 'create', idle).reasons).toEqual(['titlePrice']);
    expect(previewAvailability(values({ amount: '0' }), 'create', idle).reasons).toEqual(['titlePrice']);
    expect(previewAvailability(values({ points: {} }), 'create', idle).reasons).toEqual(['point']);
    expect(previewAvailability(values(), 'create', { activePoints: 0, uploading: true }).reasons).toEqual(['upload']);
    expect(previewAvailability(values({ title: '', points: {} }), 'create', { activePoints: 0, uploading: true }).reasons)
      .toEqual(['titlePrice', 'point', 'upload']);
  });

  it('on an existing card the points already on the showcase count', () => {
    expect(previewAvailability(values({ points: {} }), 'edit', { activePoints: 2, uploading: false }).ok).toBe(true);
    expect(previewAvailability(values({ points: {} }), 'edit', idle).reasons).toEqual(['point']);
  });
});

describe('previewBody', () => {
  it('create: the editor values as they are, with the own price of a point only when it is valid', () => {
    const body = previewBody(
      values({ points: { [LA]: { selected: true, ownPrice: null }, [LB]: { selected: true, ownPrice: '900' }, [LC]: { selected: false, ownPrice: '1' } } }),
      { kind: 'create' },
      [P1],
    );
    if (body.kind !== 'create') throw new Error('create expected');
    expect(body.photoIds).toEqual([P1]);
    expect(body.points.map((point) => point.locationId)).toEqual([LA, LB]);
    expect(body.points[0]).not.toHaveProperty('ownPrice');
    expect(cardPreviewBodySchema.safeParse(body).success).toBe(true);
  });

  it('update: the card offers with the price they take, plus the points being added', () => {
    const body = previewBody(values({ applyPrice: { [O1]: false }, points: { [LZ]: { selected: true, ownPrice: null } } }), { kind: 'edit', offerIds: [O1, O2] }, []);
    expect(body).toMatchObject({ kind: 'update', offers: [{ offerId: O1, applyPrice: false }, { offerId: O2, applyPrice: true }], addPoints: [LZ] });
    expect(cardPreviewBodySchema.safeParse(body).success).toBe(true);
  });

  it('leaves out an unusable pack instead of failing the preview', () => {
    const body = previewBody(values({ packOpen: true, packAmount: 'abc', unit: { code: 'package', custom: '' } }), { kind: 'create' }, []);
    expect(body.pack).toBeNull();
  });
});
