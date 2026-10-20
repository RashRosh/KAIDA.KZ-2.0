import { randomUUID } from 'node:crypto';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { DraftSellerRequiredError, saveOfferDraft } from '../../offers/drafts/offer-drafts';
import { listLocationsBySeller } from '../../locations/infrastructure/locations.repository';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  type SellerTextInputResponse,
  type SellerTextParseResult,
  TextInputUnavailableError,
} from '../contracts/seller-text-input.contract';
import { readSellerTextInputMode } from '../seller-text-input.config';
import { parseFakeSellerText } from '../parsers/fake-seller-text-parser';
import { mapParseLineToDraftPayload, uncertainMessage } from './map-parse-line-to-draft';

function parseText(text: string, mode: ReturnType<typeof readSellerTextInputMode>): SellerTextParseResult {
  if (mode === 'fake') return parseFakeSellerText(text);
  throw new TextInputUnavailableError();
}

export async function applySellerTextInput(
  ownerUserId: string,
  text: string,
  dependencies: { database?: Database; env?: Record<string, string | undefined> } = {},
): Promise<SellerTextInputResponse> {
  const mode = readSellerTextInputMode(dependencies.env);
  if (mode === 'off') throw new TextInputUnavailableError();

  const database = dependencies.database ?? getDatabase();
  const inputId = randomUUID();
  const parsed = parseText(text, mode);

  return database.transaction(async (tx) => {
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new DraftSellerRequiredError();

    const locations = await listLocationsBySeller(tx, seller.id);
    const defaultLocationId = locations.length === 1 ? locations[0]!.id : null;

    const drafts = [];
    const uncertain = [];

    for (const line of parsed.lines) {
      const resolution = await resolveProduct(tx, line.title);
      const catalog = resolution.status === 'resolved'
        ? { productId: resolution.product.id, status: 'resolved' as const }
        : { productId: null, status: resolution.status };

      const { payload, uncertainFields } = mapParseLineToDraftPayload(line, inputId, defaultLocationId, catalog);
      const draft = await saveOfferDraft(ownerUserId, null, payload, { database: tx as unknown as Database });
      drafts.push(draft);
      if (uncertainFields.length > 0) {
        uncertain.push({
          draftId: draft.id,
          fields: uncertainFields,
          message: uncertainMessage(uncertainFields, resolution.status),
        });
      }
    }

    return {
      inputId,
      rawText: text,
      drafts,
      skipped: parsed.skipped,
      uncertain,
    };
  });
}
