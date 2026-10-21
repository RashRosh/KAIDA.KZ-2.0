import { getDatabase, type Database } from '../../../db/client';
import { consumeContactVerification, requestContactVerification } from '../../identity/application/contact-verification';
import type { OtpDelivery, TestOtpDeliveryReceipt } from '../../identity/delivery/otp-delivery';
import { testOtpDelivery } from '../../identity/delivery/otp-delivery';
import { InvalidPhoneError, normalizeKzPhone } from '../../identity/phone/normalize-phone';
import type { IdentityClock } from '../../identity/time/identity-clock';
import { systemIdentityClock } from '../../identity/time/identity-clock';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { LocationNotFoundError, SellerRequiredError } from '../application/location-errors';
import {
  InvalidPointPhoneError,
  PointContactNotOnPointError,
  type PointDetailsInput,
  type PointDetailsView,
} from './point-details.contract';
import {
  findOwnerLoginPhone,
  findSavedTelegramUsernames,
  isNumberOnSellerPoint,
  listPointDetails,
  recordVerifiedPhone,
  updatePointDetails,
} from './point-details.repository';
import { InvalidTelegramUsernameError, normalizeTelegramUsername } from './telegram-username';

function normalize(value: string | null, field: 'phone' | 'whatsapp'): string | null {
  if (value === null || value === '') return null;
  try {
    return normalizeKzPhone(value);
  } catch (error) {
    if (error instanceof InvalidPhoneError) throw new InvalidPointPhoneError(field);
    throw error;
  }
}

async function requireSeller(database: Database, ownerUserId: string) {
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new SellerRequiredError();
  return seller;
}

export async function listOwnedPointDetails(ownerUserId: string, dependencies: { database?: Database } = {}): Promise<PointDetailsView[]> {
  const database = dependencies.database ?? getDatabase();
  const seller = await requireSeller(database, ownerUserId);
  return listPointDetails(database, seller.id);
}

// §17: the username a new or empty Telegram field may offer for reuse (a legacy value only if it is still valid).
export async function findTelegramSuggestion(ownerUserId: string, dependencies: { database?: Database } = {}): Promise<string | null> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) return null;
  const saved = await findSavedTelegramUsernames(database, seller.id);
  if (saved.point) return saved.point;
  try {
    return normalizeTelegramUsername(saved.legacy);
  } catch (error) {
    if (error instanceof InvalidTelegramUsernameError) return null;
    throw error;
  }
}

// Replaces contacts and hours of one point; never touches another point. A changed number is verified only if the
// Seller has already proved it (it then needs no new code).
export async function replaceOwnedPointDetails(
  ownerUserId: string,
  locationId: string,
  input: PointDetailsInput,
  dependencies: { database?: Database; clock?: IdentityClock } = {},
): Promise<PointDetailsView> {
  const database = dependencies.database ?? getDatabase();
  const phoneE164 = normalize(input.phone, 'phone');
  const whatsappPhoneE164 = normalize(input.whatsapp, 'whatsapp');
  // §17: undefined (an older client) leaves the saved username as it is.
  const telegram = input.telegram === undefined ? {} : { telegramUsername: normalizeTelegramUsername(input.telegram) };
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new LocationNotFoundError();
  const clock = dependencies.clock ?? systemIdentityClock;
  return database.transaction(async (tx) => {
    const view = await updatePointDetails(tx, seller.id, locationId, { phoneE164, whatsappPhoneE164, ...telegram, openingHours: input.openingHours });
    if (!view) throw new LocationNotFoundError();
    // contact-default §4.8: a point that holds the login number records the proof, so the contact does not vanish if the
    // login number is ever changed (idempotent; the number is verified by the login code already).
    const login = await findOwnerLoginPhone(tx, seller.id);
    if (login && (phoneE164 === login || whatsappPhoneE164 === login)) await recordVerifiedPhone(tx, seller.id, login, clock());
    return view;
  });
}

export async function requestPointContactCode(
  ownerUserId: string,
  rawPhone: string,
  dependencies: { database?: Database; delivery?: OtpDelivery<TestOtpDeliveryReceipt>; clock?: IdentityClock } = {},
) {
  const database = dependencies.database ?? getDatabase();
  const phoneE164 = normalize(rawPhone, 'phone')!;
  const seller = await requireSeller(database, ownerUserId);
  // Codes go only to numbers the Seller has put on a point, never to arbitrary numbers.
  if (!await isNumberOnSellerPoint(database, seller.id, phoneE164)) throw new PointContactNotOnPointError();
  const result = await requestContactVerification(ownerUserId, phoneE164, {
    delivery: dependencies.delivery ?? testOtpDelivery,
    database,
    clock: dependencies.clock,
  });
  return { ...result, phoneE164 };
}

export async function confirmPointContactCode(
  ownerUserId: string,
  input: { challengeId: string; code: string },
  dependencies: { database?: Database; clock?: IdentityClock } = {},
): Promise<{ phoneE164: string; points: PointDetailsView[] }> {
  const database = dependencies.database ?? getDatabase();
  const seller = await requireSeller(database, ownerUserId);
  const clock = dependencies.clock ?? systemIdentityClock;
  const phoneE164 = await database.transaction(async (tx) => {
    const proved = await consumeContactVerification(tx, ownerUserId, input, { clock });
    await recordVerifiedPhone(tx, seller.id, proved, clock());
    return proved;
  });
  return { phoneE164, points: await listPointDetails(database, seller.id) };
}
