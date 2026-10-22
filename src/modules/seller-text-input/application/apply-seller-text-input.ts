import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { saveOfferDraft } from '../../offers/drafts/offer-drafts';
import type { OfferDraftView } from '../../offers/drafts/offer-draft.contract';
import { listLocationsBySeller } from '../../locations/infrastructure/locations.repository';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import {
  type SellerTextInputResponse,
  type SellerTextSubmissionSummary,
  type SellerTextSubmissionView,
  TextInputPointNotFoundError,
  TextInputPointRequiredError,
  type SellerTextParseResult,
  type SellerTextParser,
  type UncertainDraftNotice,
  TextInputParserError,
  TextInputRequestConflictError,
  TextInputUnavailableError,
} from '../contracts/seller-text-input.contract';
import type { SellerTextSubmissionResult } from '../db/seller-text-submissions.table';
import {
  type SubmissionKey,
  type SubmissionRow,
  findSellerDraftsByIds,
  findSubmission,
  insertProcessingSubmission,
  listLiveSubmissions,
  markSubmissionFailed,
  markSubmissionSucceeded,
  purgeExpiredSubmissions,
  takeOverSubmission,
} from '../infrastructure/text-submissions.repository';
import { parseFakeSellerText } from '../parsers/fake-seller-text-parser';
import { parseWithRealModel } from '../parsers/real-seller-text-parser';
import { PARSER_CONFIG_ID } from '../real-parser/c2-pipeline';
import {
  type RealParserConfig,
  type TextInputUser,
  isSellerTextInputEnabledFor,
  readRealParserConfig,
  readSellerTextInputMode,
} from '../seller-text-input.config';
import { mapParseLineToDraftPayload, uncertainMessage } from './map-parse-line-to-draft';

// seller-ai-text-real-parser §6.4: retry protection lasts 24 hours; a processing attempt is live for the parser timeout
// plus 30 seconds, after which another request may take it over.
export const SUBMISSION_RETENTION_MS = 24 * 60 * 60 * 1000;
const LEASE_MARGIN_MS = 30_000;
const FAKE_PARSER_LEASE_MS = 30_000;
const POLL_INTERVAL_MS = 250;
const MAX_ROUNDS = 8;

export type ApplySellerTextInputDependencies = {
  database?: Database;
  env?: Record<string, string | undefined>;
  requestId?: string;
  locationId?: string;
  fetch?: typeof fetch;
  clock?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

export type SellerTextInputOutcome = SellerTextInputResponse & { replayed: boolean };

// Salted with the requestId so equal texts of different submissions have different digests (§6.4); the text itself is
// never stored.
export function submissionTextDigest(requestId: string, text: string, locationId?: string): string {
  const salt = locationId ? `${requestId}\n${locationId}` : requestId;
  return createHash('sha256').update(`${salt}\n${text}`, 'utf8').digest('hex');
}

function asUser(owner: string | TextInputUser): TextInputUser {
  return typeof owner === 'string' ? { id: owner, phoneE164: '' } : owner;
}

function view(row: { id: string; payload: OfferDraftView['payload']; createdAt: Date; updatedAt: Date }): OfferDraftView {
  return { id: row.id, payload: row.payload, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function logOutcome(fields: Record<string, string | number | boolean | null>) {
  // §6.5: identifiers, outcome, duration, counts and configuration only — never seller text, quotes, titles or output.
  console.info(JSON.stringify({ event: 'seller_text_input', ...fields }));
}

// The stored result with the drafts as they are now; a missing draft is published (recorded at confirm) or deleted.
async function storedResult(database: Database, row: SubmissionRow) {
  const result = row.result!;
  const found = new Map((await findSellerDraftsByIds(database, row.sellerId, result.draftIds)).map((d) => [d.id, d]));
  const drafts = result.draftIds.flatMap((id) => (found.has(id) ? [view(found.get(id)!)] : []));
  const published = new Set(result.publishedDraftIds ?? []);
  const missing = result.draftIds.filter((id) => !found.has(id));
  const publishedDrafts = missing.filter((id) => published.has(id)).length;
  return {
    inputId: row.requestId,
    parser: row.parser,
    drafts,
    skipped: result.skipped,
    uncertain: result.uncertain.filter((u) => found.has(u.draftId)),
    notices: result.notices,
    unavailableDrafts: missing.length,
    publishedDrafts,
    deletedDrafts: missing.length - publishedDrafts,
  };
}

async function replay(database: Database, row: SubmissionRow, rawText: string): Promise<SellerTextInputOutcome> {
  return { ...await storedResult(database, row), rawText, replayed: true };
}

// Review recovery (contract §16): the Seller's own submission while it is retained; anything else is unavailable.
export async function getSellerTextSubmission(
  ownerUserId: string,
  inputId: string,
  dependencies: { database?: Database; clock?: () => Date } = {},
): Promise<SellerTextSubmissionView | null> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) return null;
  const row = await findSubmission(database, { sellerId: seller.id, requestId: inputId });
  const now = (dependencies.clock ?? (() => new Date()))();
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  const base = { status: row.status, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() };
  if (row.status !== 'succeeded') {
    return { ...base, inputId: row.requestId, parser: row.parser, locationId: null, drafts: [], skipped: [], uncertain: [],
      notices: [], unavailableDrafts: 0, publishedDrafts: 0, deletedDrafts: 0 };
  }
  return { ...base, ...await storedResult(database, row), locationId: row.result!.locationId ?? null };
}

export async function listSellerTextSubmissions(
  ownerUserId: string,
  dependencies: { database?: Database; clock?: () => Date } = {},
): Promise<SellerTextSubmissionSummary[]> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) return [];
  const rows = await listLiveSubmissions(database, seller.id, (dependencies.clock ?? (() => new Date()))());
  const out: SellerTextSubmissionSummary[] = [];
  for (const row of rows) {
    const result = row.result!;
    const present = await findSellerDraftsByIds(database, seller.id, result.draftIds);
    out.push({ inputId: row.requestId, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
      drafts: present.length, skipped: result.skipped.length, notices: result.notices.length });
  }
  return out;
}

async function parse(text: string, parser: SellerTextParser, config: RealParserConfig | null,
  dependencies: ApplySellerTextInputDependencies): Promise<SellerTextParseResult> {
  if (parser === 'fake') return parseFakeSellerText(text);
  return parseWithRealModel(text, config!, { fetch: dependencies.fetch });
}

export async function applySellerTextInput(
  owner: string | TextInputUser,
  text: string,
  dependencies: ApplySellerTextInputDependencies = {},
): Promise<SellerTextInputOutcome> {
  const started = Date.now();
  const env = dependencies.env ?? process.env;
  const mode = readSellerTextInputMode(env);
  if (mode === 'off') throw new TextInputUnavailableError();
  const user = asUser(owner);
  if (!isSellerTextInputEnabledFor(user, env)) throw new TextInputUnavailableError();
  const parser: SellerTextParser = mode;
  const realConfig = parser === 'real' ? readRealParserConfig(env) as RealParserConfig : null;

  const database = dependencies.database ?? getDatabase();
  const clock = dependencies.clock ?? (() => new Date());
  const sleep = dependencies.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const leaseMs = realConfig ? realConfig.timeoutMs + LEASE_MARGIN_MS : FAKE_PARSER_LEASE_MS;

  const seller = await findSellerByOwner(database, user.id);
  if (!seller) throw new TextInputPointRequiredError();
  // Connected journey (§16): drafts go to a point of this Seller; without any point the Seller creates one first.
  const locations = await listLocationsBySeller(database, seller.id);
  if (locations.length === 0) throw new TextInputPointRequiredError();
  const locationId = dependencies.locationId;
  if (locationId && !locations.some((location) => location.id === locationId)) throw new TextInputPointNotFoundError();
  const targetLocationId = locationId ?? (locations.length === 1 ? locations[0]!.id : null);
  const key: SubmissionKey = { sellerId: seller.id, requestId: dependencies.requestId ?? randomUUID() };
  const textDigest = submissionTextDigest(key.requestId, text, locationId);
  await purgeExpiredSubmissions(database, clock());

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const now = clock();
    const attemptId = randomUUID();
    let owned = await insertProcessingSubmission(database, {
      ...key, textDigest, parser, attemptId, now, expiresAt: new Date(now.getTime() + SUBMISSION_RETENTION_MS),
    });

    if (!owned) {
      const row = await findSubmission(database, key);
      if (!row) continue; // expired and purged meanwhile: try to insert again
      if (row.textDigest !== textDigest) throw new TextInputRequestConflictError(); // rule 2
      if (row.status === 'succeeded') { // rule 3
        const outcome = await replay(database, row, text);
        logOutcome({ inputId: key.requestId, outcome: 'replay', ms: Date.now() - started, drafts: outcome.drafts.length,
          unavailable: outcome.unavailableDrafts, parser: row.parser });
        return outcome;
      }
      const stale = row.status === 'processing' && clock().getTime() - row.attemptStartedAt.getTime() >= leaseMs;
      if (row.status === 'processing' && !stale) { // rule 4: wait for the live attempt, never run a second inference
        const deadline = row.attemptStartedAt.getTime() + leaseMs;
        let current: SubmissionRow | null = row;
        while (current && current.status === 'processing' && current.attemptId === row.attemptId && clock().getTime() < deadline) {
          await sleep(POLL_INTERVAL_MS);
          current = await findSubmission(database, key);
        }
        continue; // new state: replay, failure to retry, or an attempt that became stale and is taken over (rule 5)
      }
      owned = await takeOverSubmission(database, key, row, attemptId, clock()); // rule 5
      if (!owned) continue;
    }

    let parsed: SellerTextParseResult;
    try {
      parsed = await parse(text, parser, realConfig, dependencies);
    } catch (error) {
      const code = error instanceof TextInputParserError ? error.code : 'TEXT_INPUT_FAILED';
      await markSubmissionFailed(database, key, attemptId, code).catch(() => undefined);
      logOutcome({ inputId: key.requestId, outcome: code, reason: error instanceof TextInputParserError ? error.reason : 'parser_error',
        ms: Date.now() - started, parser, config: parser === 'real' ? PARSER_CONFIG_ID : null });
      throw error;
    }

    const committed = await database.transaction(async (tx) => commitDrafts(tx as unknown as Database, {
      key, attemptId, userId: user.id, parsed, parser, now: clock, locationId: targetLocationId,
    })).catch(async (error: unknown) => {
      await markSubmissionFailed(database, key, attemptId, 'TEXT_INPUT_FAILED').catch(() => undefined);
      logOutcome({ inputId: key.requestId, outcome: 'TEXT_INPUT_FAILED', reason: 'db_error', ms: Date.now() - started, parser });
      throw error;
    });
    if (!committed) continue; // another attempt owns the row now; its result is replayed or awaited next round

    logOutcome({ inputId: key.requestId, outcome: 'created', ms: Date.now() - started, items: parsed.lines.length,
      drafts: committed.drafts.length, skipped: parsed.skipped.length, notices: committed.result.notices.length,
      uncertain: committed.result.uncertain.length, parser, config: parser === 'real' ? PARSER_CONFIG_ID : null });
    return {
      inputId: key.requestId,
      rawText: text,
      parser,
      drafts: committed.drafts,
      skipped: parsed.skipped,
      uncertain: committed.result.uncertain,
      notices: committed.result.notices,
      unavailableDrafts: 0,
      publishedDrafts: 0,
      deletedDrafts: 0,
      replayed: false,
    };
  }
  throw new TextInputParserError('TEXT_INPUT_FAILED', 'submission_contention');
}

// Rule 7: drafts are written only by the attempt that, under the row lock, still owns the submission; the drafts and
// the `succeeded` outcome commit together or not at all.
async function commitDrafts(tx: Database, input: {
  key: SubmissionKey; attemptId: string; userId: string; parsed: SellerTextParseResult;
  parser: SellerTextParser; now: () => Date; locationId: string | null;
}) {
  const { key, attemptId, parsed, parser } = input;
  const row = await findSubmission(tx, key, true);
  if (!row || row.status !== 'processing' || row.attemptId !== attemptId) return null;

  const defaultLocationId = input.locationId;
  const drafts: OfferDraftView[] = [];
  const uncertain: UncertainDraftNotice[] = [];
  for (const line of parsed.lines) {
    const resolution = await resolveProduct(tx, line.title);
    const catalog = resolution.status === 'resolved'
      ? { productId: resolution.product.id, status: 'resolved' as const }
      : { productId: null, status: resolution.status };
    const { payload, uncertainFields } = mapParseLineToDraftPayload(line, key.requestId, defaultLocationId, catalog,
      { parser, parserConfig: parser === 'real' ? PARSER_CONFIG_ID : undefined });
    const draft = await saveOfferDraft(input.userId, null, payload, { database: tx });
    drafts.push(draft);
    if (uncertainFields.length > 0) {
      uncertain.push({ draftId: draft.id, fields: uncertainFields, message: uncertainMessage(uncertainFields, resolution.status, line.notice) });
    }
  }
  const result: SellerTextSubmissionResult = {
    draftIds: drafts.map((d) => d.id), skipped: parsed.skipped, uncertain, notices: parsed.notices ?? [],
    locationId: input.locationId,
  };
  await markSubmissionSucceeded(tx, key, result, input.now());
  return { drafts, result };
}
