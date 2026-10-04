'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type MouseEvent } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { parseLastSearchState, readLastSearchRaw } from '../../../modules/search/last-search-state';
import type { SearchOffer } from '../../../modules/search/contracts/search.contract';
import { buildContactActions } from '../../../modules/sellers/contact/build-contact-actions';
import { actualityText } from '../../_components/actuality-text';
import { formatAmount } from '../../_components/format-amount';
import { OpeningHoursLine } from '../../_components/OpeningHoursLine';
import { Ic, Phone } from '../../seller/_kaida/ui';

// buyer-screens-mockup: the buyer app frame and the result card of the accepted mockup (B01), from its own classes.

export const NEARBY_NAV_INTENT_KEY = 'kaida:nearby-nav-intent';

// A result card opens the offer page by a client-side transition, which leaves document.referrer empty; this flag
// (reset by any full page load) tells the offer page that Back returns to the list it came from.
let openedFromList = false;
export function cameFromList() {
  return openedFromList;
}
export type BuyerSection = 'search' | 'nearby' | 'more';

// «Рядом» from the navigation starts locating at once (UX1C); a modified click just opens the page.
function markNearbyIntent(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  try {
    window.sessionStorage.setItem(NEARBY_NAV_INTENT_KEY, '1');
  } catch {
    // «Рядом» keeps its own start button.
  }
}

// Stage 6C: with a last Search in this tab, «Поиск» reopens it through an explicit Search address carrying the query, so
// the visitor never goes through the generic-entry routing; without one it is the plain Search address.
const subscribeToNothing = () => () => {};

export function BuyerNav({ active }: { active: BuyerSection }) {
  const { t } = useI18n();
  const lastSearchRaw = useSyncExternalStore(subscribeToNothing, readLastSearchRaw, () => null);
  const lastSearch = parseLastSearchState(lastSearchRaw);
  const searchHref = lastSearch ? `/?${new URLSearchParams({ q: lastSearch.query })}` : '/';
  const items: { key: BuyerSection; href: string; icon: string; label: string }[] = [
    { key: 'search', href: searchHref, icon: 'search', label: t('nav.search') },
    { key: 'nearby', href: '/nearby', icon: 'pin', label: t('nav.nearby') },
    { key: 'more', href: '/more', icon: 'menu', label: t('buyer.more') },
  ];
  return (
    <nav className="nav" aria-label={t('nav.main')}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={active === item.key ? 'on' : undefined}
          aria-current={active === item.key ? 'page' : undefined}
          onClick={item.key === 'nearby' ? markNearbyIntent : undefined}
        >
          <Ic name={item.icon} />{item.label}
        </Link>
      ))}
    </nav>
  );
}

export function BuyerScreen({ section, top, children, overlay }: {
  section: BuyerSection;
  top?: React.ReactNode;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  return (
    <Phone>
      {top}
      {children}
      <BuyerNav active={section} />
      {overlay}
    </Phone>
  );
}

// B01 / B02: the plaque on the photo is the one the Seller sees on «Моя витрина».
export function FreshPlaque({ offer, style }: { offer: SearchOffer; style?: React.CSSProperties }) {
  const { t } = useI18n();
  if (!offer.actuality) return null;
  const days = Math.min(6, offer.actuality.days);
  return <span className={`fresh fr${days}`} style={style}>{actualityText(offer.actuality.days, t)}</span>;
}

function contactName(label: 'Позвонить' | 'WhatsApp', t: ReturnType<typeof useI18n>['t']) {
  return label === 'Позвонить' ? t('offer.callSeller') : t('offer.writeWhatsApp');
}

// Only the point's verified contacts, as official icons with names (B01 note); none at all → no empty icons.
export function ContactIcons({ offer }: { offer: SearchOffer }) {
  const { t } = useI18n();
  const actions = offer.location.contacts ? buildContactActions(offer.location.contacts) : [];
  if (actions.length === 0) return null;
  return (
    <div className="cts" aria-label={t('offer.contacts')}>
      {actions.map((action) => (
        <a
          key={action.label}
          className="ct"
          href={action.href}
          aria-label={contactName(action.label, t)}
          {...(action.label === 'WhatsApp' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {action.label === 'WhatsApp'
            // eslint-disable-next-line @next/next/no-img-element -- the mockup's official WhatsApp mark
            ? <img src="/kaida/icons/127a626f246aa48c4b8bc196e32e93a2.svg" alt="" />
            : <Ic name="phone" />}
        </a>
      ))}
    </div>
  );
}

export function RouteButton({ offer }: { offer: SearchOffer }) {
  const { t } = useI18n();
  return (
    <a
      className="ct route"
      href={`/api/offers/${offer.id}/route`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('offer.routeTo', { place: offer.location.name })}
    >
      <Ic name="route" className="sm" />{t('offer.route')}
    </a>
  );
}

export function PriceLine({ offer, large = false }: { offer: SearchOffer; large?: boolean }) {
  return (
    <div>
      <span className={large ? 'pr-lg' : 'pr'}>{formatAmount(offer.price.amount)} ₸</span>
      {offer.price.unit && <> <span className="c2" style={large ? undefined : { fontSize: 14 }}>/ {offer.price.unit}</span></>}
    </div>
  );
}

// B01 «1,2 км»: kilometres with one decimal from 1 km, metres below.
export function formatDistance(meters: number, t: ReturnType<typeof useI18n>['t']): string {
  if (meters < 1000) return t('offer.distanceMeters', { count: meters });
  return t('offer.distanceKm', { km: (Math.round(meters / 100) / 10).toFixed(1).replace('.', ',') });
}

// B01 · Result: photo or neutral fallback with the actuality plaque, name, pack, price, point, address · distance,
// opening hours, route and the existing contacts. The whole card opens the offer page; the buttons stay separate.
export function ResultCard({ offer, distanceMeters }: { offer: SearchOffer; distanceMeters?: number }) {
  const { t } = useI18n();
  const place = [offer.location.addressText, distanceMeters !== undefined ? formatDistance(distanceMeters, t) : null]
    .filter(Boolean).join(' · ');
  return (
    <article className="card linkcard" style={{ gap: 10 }} aria-labelledby={`offer-${offer.id}`}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className={`img${offer.coverPhotoId ? '' : ' fb'}`} style={{ width: 112, height: 112, borderRadius: 12, flex: 'none' }}>
          {offer.coverPhotoId
            // eslint-disable-next-line @next/next/no-img-element -- public, immutable photo route
            ? <img src={photoUrl(offer.coverPhotoId, 'thumb')} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
            : <Ic name="logo" />}
          <FreshPlaque offer={offer} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h3 className="h3 clamp2" style={{ fontSize: 16, lineHeight: '21px', margin: 0 }} id={`offer-${offer.id}`} lang={offer.product.nameLocale}>
            <Link href={`/offers/${offer.id}`} className="stretch" onClick={() => { openedFromList = true; }}>{offer.product.name}</Link>
          </h3>
          {offer.pack && <p className="c c2" style={{ fontWeight: 500 }}>{offer.pack}</p>}
          <PriceLine offer={offer} />
          <p className="c c2" style={{ marginTop: 2 }}>{offer.location.name}</p>
          {place && <p className="c">{place}</p>}
          <OpeningHoursLine hours={offer.location.openingHours} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* stage 5A: the route action is honest — shown only when the route capability is available. */}
        {offer.routeAvailable && <RouteButton offer={offer} />}
        <span className="sp" />
        <ContactIcons offer={offer} />
      </div>
    </article>
  );
}

// B01 · Result · Loading: skeletons of the card's shape.
export function ResultSkeletons({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card" style={{ gap: 10 }} aria-hidden="true">
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="sk" style={{ width: 112, height: 112, borderRadius: 12 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="sk" style={{ height: 16, width: '80%' }} />
              <div className="sk" style={{ height: 18, width: '50%' }} />
              <div className="sk" style={{ height: 12, width: '70%' }} />
            </div>
          </div>
          <div className="sk" style={{ height: 44, width: 132, borderRadius: 22 }} />
        </div>
      ))}
    </>
  );
}

export function useBuyerSection(): BuyerSection {
  const pathname = usePathname();
  if (pathname.startsWith('/nearby')) return 'nearby';
  if (pathname.startsWith('/more')) return 'more';
  return 'search';
}
