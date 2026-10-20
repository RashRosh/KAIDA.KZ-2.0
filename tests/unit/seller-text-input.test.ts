import { describe, expect, it } from 'vitest';
import { mapParseLineToDraftPayload } from '../../src/modules/seller-text-input/application/map-parse-line-to-draft';
import { parseFakeSellerText } from '../../src/modules/seller-text-input/parsers/fake-seller-text-parser';
import { readSellerTextInputMode } from '../../src/modules/seller-text-input/seller-text-input.config';

describe('seller text input config', () => {
  it('defaults to off and accepts fake', () => {
    expect(readSellerTextInputMode({})).toBe('off');
    expect(readSellerTextInputMode({ SELLER_TEXT_INPUT: 'fake' })).toBe('fake');
    expect(readSellerTextInputMode({ SELLER_TEXT_INPUT: 'gpt' })).toBe('off');
  });
});

describe('fake seller text parser', () => {
  it('parses multiple items from one message', () => {
    const result = parseFakeSellerText('[fixture:e2e-multi]');
    expect(result.lines).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
  });

  it('returns skipped lines separately', () => {
    const result = parseFakeSellerText('[fixture:e2e-skipped]');
    expect(result.lines).toHaveLength(1);
    expect(result.skipped[0]?.label).toBe('Виноград');
  });

  it('flags uncertain unit', () => {
    const result = parseFakeSellerText('[fixture:e2e-uncertain]');
    expect(result.lines[0]?.confidence).toBe('low');
    expect(result.lines[0]?.unit).toBeNull();
  });

  it('keeps pack and package unit for free title', () => {
    const result = parseFakeSellerText('[fixture:e2e-free-title]');
    expect(result.lines[0]?.title).toContain('пельмени');
    expect(result.lines[0]?.unit).toEqual({ code: 'package' });
    expect(result.lines[0]?.pack).toEqual({ amount: '500', unit: 'g' });
  });
});

describe('map parse line to draft payload', () => {
  const inputId = '11111111-1111-4111-8111-111111111111';

  it('links resolved catalog product id', () => {
    const { payload } = mapParseLineToDraftPayload({
      title: 'Баранина',
      price: '4500',
      unit: { code: 'kg' },
      pack: null,
      confidence: 'high',
      sourceQuote: null,
    }, inputId, '22222222-2222-4222-8222-222222222222', { productId: '33333333-3333-4333-8333-333333333333', status: 'resolved' });
    expect(payload.productId).toBe('33333333-3333-4333-8333-333333333333');
    expect(payload.title).toBe('Баранина');
  });

  it('keeps free title when catalog not found', () => {
    const { payload, uncertainFields } = mapParseLineToDraftPayload({
      title: 'Наши пельмени',
      price: '1400',
      unit: { code: 'package' },
      pack: { amount: '500', unit: 'g' },
      confidence: 'high',
      sourceQuote: null,
    }, inputId, null, { productId: null, status: 'not_found' });
    expect(payload.productId).toBeNull();
    expect(payload.title).toBe('Наши пельмени');
    expect(payload.pack).toEqual({ amount: '500', unit: 'g' });
    expect(uncertainFields).not.toContain('catalog');
  });
});
