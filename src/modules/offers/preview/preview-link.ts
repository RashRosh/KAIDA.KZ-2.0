// post-publication-buyer-preview (docs/slices/post-publication-buyer-preview): the Seller opens the REAL buyer Offer page with
// `?preview=1&return=<path of the Seller cabinet>`. The parameters only add an interface (a note and a way back); they change no
// data and no eligibility. `return` is accepted only as a relative path inside the Seller cabinet (no open redirect).

const SELLER_PATH = /^\/seller(?:[/?][^\s\\\u0000-\u001f\u007f]*)?$/u;
const MAX_RETURN_LENGTH = 200;

// null → the value is not a safe return path (the whole preview mode is then ignored).
export function safePreviewReturn(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_RETURN_LENGTH) return null;
  if (!SELLER_PATH.test(value) || value.includes('//') || value.includes('..')) return null;
  return value;
}

// The buyer-page address of one Offer in preview mode.
export function previewHref(offerId: string, returnPath: string): string {
  return `/offers/${offerId}?${new URLSearchParams({ preview: '1', return: returnPath })}`;
}
