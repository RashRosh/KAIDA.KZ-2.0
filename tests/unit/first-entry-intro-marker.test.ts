import { describe, expect, it } from 'vitest';
import { INTRO_SEEN_COOKIE, shouldShowFirstEntry } from '../../src/app/(buyer)/_ui/intro-marker';

// Stage 6B: only the generic `/` (no query, no marker) shows First Entry; deep links keep the visitor's intent.
describe('First Entry routing rule', () => {
  it('shows First Entry only for the generic entry without the intro marker', () => {
    expect(shouldShowFirstEntry({ hasQuery: false, introSeen: false })).toBe(true);
  });

  it('opens the Search once the intro marker exists', () => {
    expect(shouldShowFirstEntry({ hasQuery: false, introSeen: true })).toBe(false);
  });

  it('never intercepts a deep link with a query, marker or not', () => {
    expect(shouldShowFirstEntry({ hasQuery: true, introSeen: false })).toBe(false);
    expect(shouldShowFirstEntry({ hasQuery: true, introSeen: true })).toBe(false);
  });

  it('keeps the intro marker separate from the demo flag and the locale cookie', () => {
    expect(INTRO_SEEN_COOKIE).toBe('kaida_intro_seen');
    expect(INTRO_SEEN_COOKIE).not.toBe('kaida_fe_demo_seen');
    expect(INTRO_SEEN_COOKIE).not.toBe('kaida_locale');
  });
});
