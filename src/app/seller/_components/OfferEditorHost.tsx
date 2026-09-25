'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import type { SellerChangeSetView } from '../../../modules/seller-input/contracts/seller-change-set.contract';
import type { SellerView } from '../../../modules/sellers/contracts/seller.contract';
import { OfferEditor, type EditorInitial } from './OfferEditor';
import { priceUnitDraftFrom } from './PriceUnitField';

// The editor opens over the page it was started from: `?new=1` for create, `?edit=<offer>` for edit, plus
// `from=<change set>` when the Seller returns from the confirmation page with their values.
export function useEditorHrefs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get('status');
  const returnPath = status ? `${pathname}?status=${status}` : pathname;
  const join = (extra: string) => `${returnPath}${returnPath.includes('?') ? '&' : '?'}${extra}`;
  return {
    returnPath,
    createHref: join('new=1'),
    editHref: (offerId: string) => join(`edit=${encodeURIComponent(offerId)}`),
  };
}

export function OfferEditorHost({ seller, offers, commentTranslationEnabled }: {
  seller: SellerView | null;
  offers: SellerOfferView[];
  commentTranslationEnabled: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { returnPath } = useEditorHrefs();
  const creating = params.get('new') === '1';
  const editId = params.get('edit');
  const from = params.get('from');
  const editOffer = editId ? offers.find((offer) => offer.id === editId) : undefined;
  const [returned, setReturned] = useState<{ from: string; initial: EditorInitial | null } | null>(null);

  // «Вернуться к правке»: refill from that proposed change set, including product, unit and chosen point.
  useEffect(() => {
    if (!from || (!creating && !editId)) return;
    let alive = true;
    void (async () => {
      let initial: EditorInitial | null = null;
      try {
        const response = await fetch(`/api/seller/change-sets/${encodeURIComponent(from)}`, { cache: 'no-store' });
        const data = response.ok ? await response.json() as { changeSet?: SellerChangeSetView } : {};
        const item = data.changeSet?.status === 'proposed' && data.changeSet.items.length === 1 ? data.changeSet.items[0] : undefined;
        if (item?.price && (item.action === 'create_offer' || item.action === 'update_offer')) {
          initial = {
            ...(item.action === 'create_offer' ? { productName: item.product.name, locationId: item.location.id } : {}),
            amount: item.price.amount,
            unit: priceUnitDraftFrom(item.price.unitChoice),
            comment: item.sellerComment ?? '',
          };
        }
      } catch {
        // An unreadable proposal opens the form with its usual starting values.
      }
      if (alive) setReturned({ from, initial });
    })();
    return () => { alive = false; };
  }, [from, creating, editId]);

  const waiting = Boolean(from) && returned?.from !== from;
  if ((!creating && !editOffer) || waiting) return null;
  const initial = from ? returned?.initial ?? undefined : undefined;

  return (
    <OfferEditor
      key={`${creating ? 'new' : editId}:${from ?? ''}`}
      mode={creating ? { kind: 'create' } : { kind: 'edit', offer: editOffer! }}
      seller={seller}
      initial={initial}
      returnPath={returnPath}
      commentTranslationEnabled={commentTranslationEnabled}
      onClose={() => router.replace(returnPath, { scroll: false })}
    />
  );
}
