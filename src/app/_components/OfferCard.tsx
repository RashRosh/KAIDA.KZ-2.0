import type { SearchOffer } from '@/modules/search/contracts/search.contract';
import { buildContactActions, type ContactAction } from '../../modules/sellers/contact/build-contact-actions';
import styles from '../page.module.css';

// Keep the decimal as a string throughout formatting, including large amounts.
export function formatAmount(amount: string): string {
  const [whole, fraction] = amount.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (decimals ? `,${decimals}` : '');
}

type InterestControl = {
  active: boolean;
  pending: boolean;
  onToggle: () => void;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"
        className={filled ? styles.interestIconFilled : undefined}
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function SellerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 10h16" />
      <path d="M5 10V7l2-3h10l2 3v3" />
      <path d="M6 10v10h12V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.6a2 2 0 0 1-.5 2.1L9 10.6a16 16 0 0 0 4.4 4.4l1.2-1.2a2 2 0 0 1 2.1-.5c.8.4 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h2a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4" />
    </svg>
  );
}

// Canonical messenger glyph geometry is kept unmodified and rendered in each service's brand color.
// Brand usage rules: Meta Brand Resource Center for WhatsApp/Instagram and telegram.org/press for Telegram.
function WhatsAppIcon() {
  return (
    <svg className={`${styles.serviceIcon} ${styles.whatsappIcon}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg className={`${styles.serviceIcon} ${styles.telegramIcon}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className={`${styles.serviceIcon} ${styles.instagramIcon}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </svg>
  );
}

function SocialIcon({ label }: { label: ContactAction['label'] }) {
  if (label === 'WhatsApp') return <WhatsAppIcon />;
  if (label === 'Telegram') return <TelegramIcon />;
  if (label === 'Instagram') return <InstagramIcon />;
  return null;
}

export function OfferCard({
  offer,
  distanceMeters,
  interest,
}: {
  offer: SearchOffer;
  distanceMeters?: number;
  interest?: InterestControl;
}) {
  const contactActions = offer.seller.contacts ? buildContactActions(offer.seller.contacts) : [];
  const phoneAction = contactActions.find((action) => action.label === 'Позвонить');
  const socialActions = contactActions.filter((action) => action.label !== 'Позвонить');

  return (
    <article className={styles.offer} aria-labelledby={`offer-${offer.id}`}>
      <div className={styles.offerTop}>
        <div className={styles.offerTitleBlock}>
          <h2 id={`offer-${offer.id}`}>{offer.product.name}</h2>
          <p className={styles.price}>
            {offer.price
              ? <>{formatAmount(offer.price.amount)} {offer.price.currency === 'KZT' ? '₸' : offer.price.currency}{offer.price.unit && <span className={styles.priceUnit}> / {offer.price.unit}</span>}</>
              : <span className={styles.noPrice}>Цена не указана</span>}
          </p>
        </div>

        {interest && (
          <button
            type="button"
            className={styles.interestAction}
            aria-pressed={interest.active}
            disabled={interest.pending}
            onClick={interest.onToggle}
          >
            <HeartIcon filled={interest.active} />
            <span>{interest.pending ? 'Сохраняем…' : interest.active ? 'В интересах' : 'Добавить в интересы'}</span>
          </button>
        )}
      </div>

      <div className={styles.locationBlock}>
        <span className={styles.offerMetaIcon}><PinIcon /></span>
        <div className={styles.locationCopy}>
          <div className={styles.locationLine}>
            <strong>{offer.location.name}</strong>
            {distanceMeters !== undefined && <span className={styles.distance}>{distanceMeters} м</span>}
          </div>
          <span className={styles.address}>{offer.location.addressText}</span>
        </div>
      </div>

      {offer.sellerComment && <p className={styles.comment}>{offer.sellerComment}</p>}

      <div className={styles.sellerLine}>
        <span className={styles.offerMetaIcon}><SellerIcon /></span>
        <span>{offer.seller.displayName}</span>
      </div>

      {phoneAction && (
        <div className={styles.offerActions}>
          <div className={styles.primaryActions} aria-label="Основные действия">
            <a className={`${styles.contactAction} ${styles.contactActionPrimary}`} href={phoneAction.href}>
              <PhoneIcon />
              <span>Позвонить</span>
            </a>
            <a
              className={`${styles.contactAction} ${styles.routeAction}`}
              href={`/api/offers/${offer.id}/route`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <RouteIcon />
              <span>Маршрут</span>
            </a>
          </div>

          {socialActions.length > 0 && (
            <div
              className={styles.secondaryActions}
              data-count={socialActions.length}
              aria-label="Дополнительные контакты"
            >
              {socialActions.map((action) => (
                <a
                  className={`${styles.contactAction} ${styles.contactActionSecondary}`}
                  href={action.href}
                  key={action.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={action.label}
                >
                  <SocialIcon label={action.label} />
                  <span className={styles.socialActionText}>{action.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
