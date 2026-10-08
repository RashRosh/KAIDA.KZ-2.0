import { describe, expect, it } from 'vitest';
import { previewHref, safePreviewReturn } from '../../src/modules/offers/preview/preview-link';

// post-publication-buyer-preview §3.4: `return` is a relative path inside the Seller cabinet and nothing else.
describe('safePreviewReturn', () => {
  it('accepts the Seller cabinet paths the preview returns to', () => {
    for (const value of ['/seller', '/seller?card=11111111-1111-4111-8111-111111111111', '/seller?tab=drafts', '/seller/points', '/seller/change-sets/abc?back=%2Fseller']) {
      expect(safePreviewReturn(value), value).toBe(value);
    }
  });
  it('rejects everything else: other paths, absolute and protocol-relative addresses, schemes, backslashes, control characters, traversal', () => {
    for (const value of [
      '', '/', '/offers/1', '/sellers', '/seller2', 'seller', 'https://evil.example/seller', '//evil.example', '/seller//evil.example', '/seller?x=//evil.example',
      'javascript:alert(1)', '/seller\evil', '/seller\nx', '/seller\tx', '/seller x', '/seller/../offers', '/%2F%2Fevil', ` /seller`, `/seller?${'a'.repeat(300)}`,
    ]) expect(safePreviewReturn(value), JSON.stringify(value)).toBeNull();
    expect(safePreviewReturn(null)).toBeNull();
    expect(safePreviewReturn(undefined)).toBeNull();
  });
});

describe('previewHref', () => {
  it('opens the buyer Offer page with the preview flag and the encoded return path', () => {
    const href = previewHref('22222222-2222-4222-8222-222222222222', '/seller?card=abc');
    expect(href).toBe('/offers/22222222-2222-4222-8222-222222222222?preview=1&return=%2Fseller%3Fcard%3Dabc');
    expect(safePreviewReturn(new URL(href, 'http://x').searchParams.get('return'))).toBe('/seller?card=abc');
  });
});
