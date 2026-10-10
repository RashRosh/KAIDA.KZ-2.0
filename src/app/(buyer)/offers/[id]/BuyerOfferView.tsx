'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BuyerReportFlow } from './BuyerReportFlow';
import { useRouter, useSearchParams } from 'next/navigation';
import { safePreviewReturn } from '@/modules/offers/preview/preview-link';
import type { BuyerOfferPage } from '@/modules/search/application/get-buyer-offer';
import { useI18n } from '@/i18n/I18nProvider';
import { Ic } from '../../../seller/_kaida/ui';
import { BuyerScreen, cameFromList } from '../../_ui/buyer-ui';
import { OfferDetails } from '../../_ui/offer-details';
import { useInterest } from '../../_ui/use-interest';

// buyer-screens-mockup · B02 offer detail: gallery (or neutral fallback, or a photo error that keeps the data), the
// actuality plaque, name, pack, price, the seller comment, the point block with route and contacts, the seller and
// the interest action. Same eligibility as Search (offer-photos §2).

// post-publication-buyer-preview: the Seller's preview of an own published Offer — `preview=1` with a safe `return` path inside
// the Seller cabinet. It only adds a note, a way back and hides the interest action; the page and its data are the buyer's.
function usePreviewReturn(): string | null {
  const params = useSearchParams();
  return params.get('preview') === '1' ? safePreviewReturn(params.get('return')) : null;
}

function PreviewNote({ returnTo }: { returnTo: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div role="note" style={{ display: 'flex', flexDirection: 'column', padding: '8px 16px', background: 'var(--sunken)', borderBottom: '1px solid var(--line)' }}>
      <p className="c c2" style={{ margin: 0 }}>{t('preview.strip')}</p>
      <Link
        href={returnTo}
        className="t"
        style={{ margin: '-6px 0', padding: '12px 0', display: 'block', textDecoration: 'underline', overflowWrap: 'anywhere' }}
        onClick={(event) => {
          if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
            event.preventDefault();
            router.back();
          }
        }}
      >{t('preview.back')}</Link>
    </div>
  );
}

function BackButton({ returnTo }: { returnTo: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Link
      href={returnTo ?? '/'}
      className="ib"
      aria-label={t('offer.back')}
      style={{ background: '#ffffffe6', position: 'absolute', top: 8, left: 8, zIndex: 2 }}
      onClick={(event) => {
        // Back to the same results (the query is kept in the search address); a direct visit goes to search.
        if (window.history.length > 1 && ((returnTo === null && cameFromList()) || document.referrer.startsWith(window.location.origin))) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <Ic name="left" />
    </Link>
  );
}

export function BuyerOfferView({ offer, reporting = false }: { offer: BuyerOfferPage; reporting?: boolean }) {
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useI18n();
  const returnTo = usePreviewReturn();
  // in the Seller's preview there is no interest action and no request for it
  const interest = useInterest(returnTo === null ? offer.product.id : null);
  if (reportOpen) return <BuyerReportFlow offerId={offer.id} onClose={() => { setReportOpen(false); requestAnimationFrame(() => document.getElementById('report-entry')?.focus()); }} />;
  return (
    <BuyerScreen section="search" overlay={interest.modal}>
      <main className="body np" style={{ gap: 0 }}>
        {returnTo !== null && <PreviewNote returnTo={returnTo} />}
        <OfferDetails
          offer={offer}
          back={<BackButton returnTo={returnTo} />}
          footer={(
            <>
              {reporting && returnTo === null && <button id="report-entry" type="button" className="btn btn-o w" onClick={() => setReportOpen(true)}>{t('report.title')}</button>}
              {interest.available && (
                <button type="button" className="btn btn-o w" aria-pressed={interest.active} disabled={interest.pending} onClick={(event) => void interest.toggle(event)}>
                  <Ic name={interest.active ? 'starf' : 'star'} className="sm" />
                  {interest.pending ? t('offer.saving') : interest.active ? t('offer.inInterests') : t('offer.addInterest')}
                </button>
              )}
              {interest.error && <div className="fld"><p className="emsg" role="alert"><Ic name="alert" />{t('search.interestError')}</p></div>}
            </>
          )}
        />
      </main>
    </BuyerScreen>
  );
}

export function OfferUnavailable({ failed }: { failed: boolean }) {
  const { t } = useI18n();
  // in the Seller's preview the way back is the card, not the search
  const returnTo = usePreviewReturn();
  return (
    <BuyerScreen section="search">
      <main className="body" style={{ justifyContent: 'center', gap: 16, padding: '24px 20px', textAlign: 'center' }} aria-labelledby="offer-unavailable">
        <h1 className="h2" id="offer-unavailable">{failed ? t('offer.loadFailedTitle') : t('offer.unavailableTitle')}</h1>
        <p className="t c2">{failed ? t('offer.loadFailedText') : t('offer.unavailableText')}</p>
        {returnTo !== null
          ? <Link href={returnTo} className="btn btn-p lg w">{t('preview.back')}</Link>
          : <Link href="/" className="btn btn-p lg w">{t('offer.toSearch')}</Link>}
      </main>
    </BuyerScreen>
  );
}
