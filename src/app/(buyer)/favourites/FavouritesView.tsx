'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { Favourite } from '../../../modules/favourites/contracts/favourites.contract';
import { photoUrl } from '../../../modules/media/contracts/photo.contract';
import { Bar, Ic } from '../../seller/_kaida/ui';
import { BuyerScreen, ResultCard, ResultSkeletons } from '../_ui/buyer-ui';
import { FavouriteHeart } from '../_ui/FavouriteHeart';
import { useFavourites } from '../_ui/use-favourites';

function UnavailableCard({ entry }: { entry: Extract<Favourite, { state: 'unavailable' }> }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const cover = entry.coverPhotoId && !failed ? entry.coverPhotoId : null;
  return <article className="card" style={{ gap: 10 }} aria-labelledby={`saved-${entry.id}`}>
    <div style={{ display: 'flex', gap: 12 }}>
      <div className={`img${cover ? '' : ' fb'}`} style={{ width: 112, height: 112, borderRadius: 12, flex: 'none' }}>
        {cover ? /* eslint-disable-next-line @next/next/no-img-element -- existing ordinary media authorization */
          <img src={photoUrl(cover, 'thumb')} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Ic name="logo" />}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <h3 className="h3 clamp2" style={{ fontSize: 16, lineHeight: '21px', margin: 0 }} id={`saved-${entry.id}`}>{entry.title}</h3>
        <p className="c c2" style={{ marginTop: 4 }}>{t('fav.unavailable')}</p>
        <p className="c c2" style={{ marginTop: 2 }}>{entry.pointName}</p>
      </div>
    </div>
    <p className="c c2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ic name="store" className="sm" />{entry.sellerName}</p>
  </article>;
}

export function FavouritesView() {
  const { t } = useI18n();
  const fav = useFavourites();
  const router = useRouter();
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    if (fav.state.kind !== 'ready') return;
    // Scroll-only state; never persist private content or identity in the browser.
    try {
      const y = Number(sessionStorage.getItem('kaida-favourites-scroll') ?? 0);
      if (Number.isFinite(y)) requestAnimationFrame(() => list.current?.scrollTo(0, y));
    } catch { /* Scroll restoration is optional. */ }
  }, [fav.state.kind]);
  return <BuyerScreen section="more" top={<Bar title={t('fav.title')} onBack={() => router.push('/more')} backLabel={t('offer.back')} />} overlay={fav.modal}>
    <main ref={list} className="body" style={{ gap: 12 }}>
      {fav.state.kind === 'loading' && <ResultSkeletons />}
      {fav.state.kind === 'anonymous' && <div className="card"><h2 className="h3">{t('fav.signInTitle')}</h2><p className="b">{t('fav.authDescription')}</p><button type="button" className="btn btn-p w" onClick={fav.signIn}>{t('auth.signIn')}</button></div>}
      {fav.state.kind === 'error' && <div className="card" role="alert"><p className="b">{t('fav.loadError')}</p><button className="btn btn-o w" onClick={() => void fav.reload()}>{t('cabinet.retry')}</button></div>}
      {fav.error && <p className="emsg" role="alert">{t('fav.writeError')}</p>}
      {fav.state.kind === 'ready' && !fav.state.favourites.length && <div className="card"><h2 className="h3" style={{ margin: 0 }}>{t('fav.emptyTitle')}</h2><p className="b">{t('fav.emptyText')}</p><Link href="/" className="btn btn-o w">{t('fav.find')}</Link></div>}
      {fav.state.kind === 'ready' && fav.state.favourites.map(entry => <div key={entry.id} data-testid="favourite-entry" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entry.state === 'available' ? <ResultCard offer={entry.offer} detailHref={`/offers/${entry.offerId}?return=%2Ffavourites`} onOpen={() => { try { sessionStorage.setItem('kaida-favourites-scroll', String(list.current?.scrollTop ?? 0)); } catch { /* Scroll persistence is optional. */ } }} /> : <UnavailableCard key={`${entry.id}:${entry.coverPhotoId ?? ''}`} entry={entry} />}
        <button type="button" className="btn btn-g w" aria-pressed="true" disabled={fav.pendingId !== null} aria-busy={fav.pendingId === entry.id} onClick={() => void fav.remove(entry.id)} style={{ minHeight: 44, color: 'var(--ink2)' }}><FavouriteHeart active />{fav.pendingId === entry.id ? t('fav.removing') : t('fav.remove')}</button>
      </div>)}
    </main>
  </BuyerScreen>;
}
