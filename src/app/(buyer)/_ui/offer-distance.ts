'use client';

import { useSyncExternalStore } from 'react';
import type { DistanceBasis } from '@/modules/geo/distance-basis';
import type { SearchOffer } from '@/modules/search/contracts/search.contract';

export type OfferDistance = { meters: number; basis: DistanceBasis };
type Handoff = { offerId: string; locationId: string; distance: OfferDistance };

let handoff: Handoff | null = null;
let expiry: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function displayedDistance(offer: SearchOffer, basis: DistanceBasis | undefined): number | undefined {
  return basis === 'road' ? offer.roadDistanceMeters : offer.distanceMeters;
}

export function clearOfferDistance() {
  clearTimeout(expiry);
  if (!handoff) return;
  handoff = null;
  for (const notify of listeners) notify();
}

export function rememberOfferDistance(offer: SearchOffer, basis: DistanceBasis | undefined) {
  clearOfferDistance();
  const meters = displayedDistance(offer, basis);
  if (meters === undefined) return;
  handoff = { offerId: offer.id, locationId: offer.location.id, distance: { meters, basis: basis ?? 'straight' } };
  expiry = setTimeout(clearOfferDistance, 5 * 60_000);
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

export function useOfferDistance(offer: Pick<SearchOffer, 'id' | 'location'>): OfferDistance | null {
  return useSyncExternalStore(subscribe, () => (
    handoff?.offerId === offer.id && handoff.locationId === offer.location.id ? handoff.distance : null
  ), () => null);
}
