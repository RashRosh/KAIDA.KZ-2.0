import { findActiveRemovalsBySeller } from '../../moderation/infrastructure/moderation.repository';
import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { saveOfferDraft } from '../../offers/drafts/offer-drafts';
import type { OfferDraftView } from '../../offers/drafts/offer-draft.contract';
import { listLocationsBySeller } from '../../locations/infrastructure/locations.repository';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import type { Locale } from '../../../i18n/config';
import { createDeactivationChangeSet } from '../../seller-input/application/create-batch-seller-change-set';
import { matchAvailability } from '../../seller-input/application/match-availability';
import { checkDuplicates, duplicateOutcome, preselectedForPrice, preselectedForReturn, priceDiffers } from '../../seller-input/application/match-duplicates';
import { createPriceUpdateChangeSet } from '../../seller-input/application/create-batch-seller-change-set';
import { findOwnedOfferForManagement } from '../../offers/infrastructure/offers.repository';
import type { DuplicateLineInput, PriceProposalState } from '../../seller-input/contracts/duplicates.contract';
import type { AvailabilityStatementView } from '../../seller-input/contracts/availability.contract';
import { OfferChangedError } from '../../seller-input/contracts/seller-change-set.contract';
import { findDeactivationItems, findPriceUpdateItems } from '../../seller-input/infrastructure/seller-change-sets.repository';
import {
  type AvailabilityProposalBody,
  type HeldLineView,
  type PriceProposalBody,
  TextPriceChangedError,
  TextPriceRejectedError,
  type ParsedTextLine,
  type DraftNoteView,
  type SellerTextInputResponse,
  TextAvailabilityChangedError,
  TextInputReviewUnavailableError,
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
  recordAvailabilityChangeSet,
  replaceSubmissionResult,
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
import { mergeRepeatedLines, PRICE_CONFLICT_NOTICE } from './merge-repeated-lines';

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

// text-availability §4.1 items 3–5: the statements of a submission with candidates from current data, and the
// proposals of this review that still wait for confirmation.
async function availabilityOf(database: Database, ownerUserId: string, row: SubmissionRow, locale?: Locale) {
  const result = row.result!;
  const tracked = await findDeactivationItems(database, row.sellerId, result.availabilityChangeSetIds ?? []);
  const availability = await matchAvailability(ownerUserId, result.locationId ?? null, result.unavailable ?? [], tracked,
    { database, locale });
  const blocks = await reviewBlocks(database, ownerUserId, row.sellerId, result, locale);
  for (const view of availability) for (const candidate of view.candidates) {
    candidate.blocked = blocks.get(candidate.offerId);
    if (candidate.blocked) candidate.selectable = false;
  }
  const pendingRevision = new Map(availability.flatMap((view) => view.candidates)
    .filter((candidate) => candidate.status === 'pending').map((candidate) => [candidate.offerId, candidate.revision]));
  const pendingChangeSetIds = [...new Set(tracked.filter((item) => item.changeSetStatus === 'proposed'
    && pendingRevision.get(item.offerId) === item.expectedRevision).map((item) => item.changeSetId))];
  return { availability, pendingChangeSetIds };
}

function duplicateInput(line: ParsedTextLine): DuplicateLineInput {
  return {
    title: line.title,
    price: line.price,
    unit: line.unit,
    pack: line.pack,
    uncertain: line.uncertainFields ?? (line.confidence === 'low' ? ['unit'] : []),
    priceChoices: line.priceChoices,
    possiblyMerged: Boolean(line.mergedFragments) || (line.uncertainFields ?? []).includes('title'),
  };
}

// text-duplicates §4.1, §4.5: held lines with candidates and differences from current data, notes on drafts that have
// the same product in another pack, and the price choices of drafts whose price is still not chosen.
async function duplicatesOf(database: Database, ownerUserId: string, result: SellerTextSubmissionResult,
  drafts: OfferDraftView[], locale?: Locale) {
  const locationId = result.locationId ?? null;
  const heldLines = result.held ?? [];
  const present = new Set(drafts.map((draft) => draft.id));
  const heldChecks = await checkDuplicates(ownerUserId, locationId, heldLines.map((held) => duplicateInput(held.line)), { database, locale });
  const sellerId = drafts.length > 0 || heldLines.length > 0 ? (await findSellerByOwner(database, ownerUserId))?.id ?? null : null;
  const states = sellerId ? await priceProposalStates(database, sellerId, result.priceProposals ?? []) : new Map<string, PriceProposalState>();
  // The latest proposal that includes the line is the one the row shows.
  const latestByLine = new Map<number, { changeSetId: string; offerId: string; price: string; action?: 'update_offer' | 'activate_offer' }>();
  const blocks = sellerId ? await reviewBlocks(database, ownerUserId, sellerId, result, locale) : new Map();
  for (const check of heldChecks) for (const candidate of check.candidates) {
    candidate.blocked = blocks.get(candidate.offerId);
    if (candidate.blocked) { candidate.priceEligible = false; candidate.returnEligible = false; }
  }
  for (const proposal of result.priceProposals ?? []) {
    for (const item of proposal.items) latestByLine.set(item.index, { changeSetId: proposal.changeSetId, offerId: item.offerId, price: item.price, action: item.action });
  }
  const held: HeldLineView[] = heldLines.map((entry, index) => {
    const latest = latestByLine.get(index);
    const priceProposal = latest ? { ...latest, state: states.get(latest.changeSetId) ?? 'stale' as const } : null;
    return {
      index,
      quote: entry.line.sourceQuote ?? entry.line.title,
      title: entry.line.title,
      linePrice: entry.line.price && !duplicateInput(entry.line).uncertain.includes('price') ? entry.line.price : null,
      priceChoices: entry.line.priceChoices ?? null,
      mergedFragments: entry.line.mergedFragments ?? null,
      possiblyMerged: duplicateInput(entry.line).possiblyMerged === true,
      outcome: duplicateOutcome(heldChecks[index]!.candidates),
      candidates: heldChecks[index]!.candidates,
      draftId: entry.draftId && present.has(entry.draftId) ? entry.draftId : null,
      // §3.5: after a refused or stale proposal the Seller chooses again — the card is never re-selected for them.
      pricePreselect: priceProposal?.state === 'stale' || result.unselectedHeldIndices?.includes(index) ? null : preselectedForPrice(duplicateInput(entry.line), heldChecks[index]!.candidates),
      returnPreselect: priceProposal?.state === 'stale' || result.unselectedHeldIndices?.includes(index) ? null : preselectedForReturn(duplicateInput(entry.line), heldChecks[index]!.candidates),
      priceProposal,
    };
  });
  const pricePendingChangeSetIds = [...new Set(held.flatMap((line) => (line.priceProposal?.state === 'pending' ? [line.priceProposal.changeSetId] : [])))];
  const draftChecks = await checkDuplicates(ownerUserId, locationId, drafts.map((draft) => ({
    title: draft.payload.title, price: draft.payload.price || null, unit: draft.payload.unit, pack: draft.payload.pack, uncertain: [],
  })), { database, locale });
  const draftNotes: DraftNoteView[] = drafts.flatMap((draft, k) => (draftChecks[k]!.otherPacks.length > 0
    ? [{ draftId: draft.id, otherPacks: draftChecks[k]!.otherPacks.map((other) => ({ title: other.title, packLabel: other.packLabel })) }]
    : []));
  const priceChoices = (result.priceChoices ?? []).filter((entry) => present.has(entry.draftId));
  return { held, draftNotes, priceChoices, pricePendingChangeSetIds };
}

// The stored result with the drafts as they are now; a missing draft is published (recorded at confirm) or deleted.
async function storedResult(database: Database, row: SubmissionRow, ownerUserId: string, locale?: Locale) {
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
    ...await availabilityOf(database, ownerUserId, row, locale),
    ...await duplicatesOf(database, ownerUserId, result, drafts, locale),
  };
}

async function replay(database: Database, row: SubmissionRow, rawText: string, ownerUserId: string): Promise<SellerTextInputOutcome> {
  return { ...await storedResult(database, row, ownerUserId), rawText, replayed: true };
}

// Review recovery (contract §16): the Seller's own submission while it is retained; anything else is unavailable.
export async function getSellerTextSubmission(
  ownerUserId: string,
  inputId: string,
  dependencies: { database?: Database; clock?: () => Date; locale?: Locale } = {},
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
      notices: [], unavailableDrafts: 0, publishedDrafts: 0, deletedDrafts: 0, availability: [], pendingChangeSetIds: [],
      held: [], draftNotes: [], priceChoices: [], pricePendingChangeSetIds: [] };
  }
  return { ...base, ...await storedResult(database, row, ownerUserId, dependencies.locale), locationId: row.result!.locationId ?? null };
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
        const outcome = await replay(database, row, text, user.id);
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
      uncertain: committed.result.uncertain.length, unavailable: committed.result.unavailable?.length ?? 0, parser,
      config: parser === 'real' ? PARSER_CONFIG_ID : null });
    const saved = (await findSubmission(database, key))!;
    const { availability } = await availabilityOf(database, user.id, saved);
    const duplicates = await duplicatesOf(database, user.id, committed.result, committed.drafts);
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
      availability,
      pendingChangeSetIds: [],
      ...duplicates,
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
  const priceChoices: NonNullable<SellerTextSubmissionResult['priceChoices']> = [];
  const held: NonNullable<SellerTextSubmissionResult['held']> = [];
  // text-duplicates §4.1–§4.2: one line per product of the message; a line with a possible match at the point is held
  // back (no automatic draft), also when its prices conflict.
  const lines = mergeRepeatedLines(parsed.lines);
  const checks = await checkDuplicates(input.userId, defaultLocationId, lines.map(duplicateInput), { database: tx });
  for (const [k, line] of lines.entries()) {
    if (checks[k]!.candidates.length > 0) {
      held.push({ line, draftId: null });
      continue;
    }
    const made = await createDraftFromLine(tx, { userId: input.userId, inputId: key.requestId, line, parser, locationId: defaultLocationId });
    drafts.push(made.draft);
    if (made.uncertain) uncertain.push(made.uncertain);
    if (line.priceChoices) priceChoices.push({ draftId: made.draft.id, choices: line.priceChoices });
  }
  const result: SellerTextSubmissionResult = {
    draftIds: drafts.map((d) => d.id), skipped: parsed.skipped, uncertain, notices: parsed.notices ?? [],
    locationId: input.locationId, unavailable: parsed.unavailable ?? [], held, priceChoices,
  };
  await markSubmissionSucceeded(tx, key, result, input.now());
  return { drafts, result };
}

// text-availability §4.1 item 5: compare what the Seller saw with the current candidates and, only when nothing that
// decides the match or the choice changed, create one switch-off proposal expecting the revisions the Seller saw.
// No row is locked: a card added after this comparison does not affect the chosen offers, and the existing confirm guard
// refuses any later change of them.
export async function proposeTextAvailability(
  ownerUserId: string,
  inputId: string,
  body: AvailabilityProposalBody,
  dependencies: { database?: Database; clock?: () => Date; locale?: Locale } = {},
): Promise<{ changeSetId: string }> {
  const database = dependencies.database ?? getDatabase();
  const now = (dependencies.clock ?? (() => new Date()))();
  return database.transaction(async (transaction) => {
    const tx = transaction as unknown as Database;
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new TextInputReviewUnavailableError();
    const key: SubmissionKey = { sellerId: seller.id, requestId: inputId };
    const row = await findSubmission(tx, key);
    if (!row || row.status !== 'succeeded' || row.expiresAt.getTime() <= now.getTime()) throw new TextInputReviewUnavailableError();
    const current = async () => (await availabilityOf(tx, ownerUserId, row, dependencies.locale)).availability;
    const fresh = await current();

    const changed: number[] = [];
    const targets = new Map<string, number>();
    for (const statement of body.statements) {
      const view: AvailabilityStatementView | undefined = fresh[statement.index];
      if (!view) { changed.push(statement.index); continue; }
      const shown = new Set(statement.shown.map((c) => `${c.offerId}:${c.revision}`));
      const present = new Set(view.candidates.map((c) => `${c.offerId}:${c.revision}`));
      const selectable = new Map(view.candidates.filter((c) => c.selectable).map((c) => [c.offerId, c.revision]));
      if (shown.size !== present.size || [...shown].some((k) => !present.has(k)) || statement.selected.some((id) => !selectable.has(id))) {
        changed.push(statement.index);
        continue;
      }
      for (const id of statement.selected) targets.set(id, selectable.get(id)!);
    }
    if (changed.length > 0) throw new TextAvailabilityChangedError(fresh, changed);

    let changeSetId: string;
    try {
      changeSetId = await createDeactivationChangeSet(tx, seller.id,
        [...targets].map(([offerId, expectedRevision]) => ({ offerId, expectedRevision })));
    } catch (error) {
      // Changed between the comparison and the proposal: nothing is created; the Seller chooses again.
      if (error instanceof OfferChangedError) {
        throw new TextAvailabilityChangedError(await current(), body.statements.map((statement) => statement.index));
      }
      throw error;
    }
    await recordAvailabilityChangeSet(tx, key, changeSetId);
    logOutcome({ inputId, outcome: 'availability_proposed', offers: targets.size });
    return { changeSetId };
  });
}

// One private draft from a parsed line, exactly as the list review creates it (slices 1–2), plus its notice.
async function createDraftFromLine(tx: Database, input: {
  userId: string; inputId: string; line: ParsedTextLine; parser: SellerTextParser; locationId: string | null;
}) {
  const { line } = input;
  const resolution = await resolveProduct(tx, line.title);
  const catalog = resolution.status === 'resolved'
    ? { productId: resolution.product.id, status: 'resolved' as const }
    : { productId: null, status: resolution.status };
  const { payload, uncertainFields } = mapParseLineToDraftPayload(line, input.inputId, input.locationId, catalog,
    { parser: input.parser, parserConfig: input.parser === 'real' ? PARSER_CONFIG_ID : undefined });
  const draft = await saveOfferDraft(input.userId, null, payload, { database: tx });
  if (uncertainFields.length === 0) return { draft, uncertain: null };
  // A price conflict is told by the review's own choice row; the notice keeps only what else the Seller must check.
  const notice = line.priceChoices
    ? (line.notice ?? '').split('; ').filter((part) => part && part !== PRICE_CONFLICT_NOTICE).join('; ')
    : line.notice;
  if (line.priceChoices && !notice) return { draft, uncertain: null };
  const fragments = line.mergedFragments ? ` Фрагменты: ${line.mergedFragments.map((f) => `«${f}»`).join(' · ')}` : '';
  return {
    draft,
    uncertain: { draftId: draft.id, fields: uncertainFields, message: `${uncertainMessage(uncertainFields, resolution.status, notice || undefined)}${fragments}` },
  };
}

// text-duplicates §4.5: «Это другой товар — создать черновик». The submission row is locked (as slice 2 §6.4 does for its
// record), so a double tap, a second tab or a reload gets the same draft; a draft deleted since then is made anew.
export async function createDraftFromHeldLine(
  ownerUserId: string,
  inputId: string,
  index: number,
  dependencies: { database?: Database; clock?: () => Date } = {},
): Promise<{ draftId: string; created: boolean }> {
  const database = dependencies.database ?? getDatabase();
  const now = (dependencies.clock ?? (() => new Date()))();
  return database.transaction(async (transaction) => {
    const tx = transaction as unknown as Database;
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new TextInputReviewUnavailableError();
    const key: SubmissionKey = { sellerId: seller.id, requestId: inputId };
    const row = await findSubmission(tx, key, true);
    if (!row || row.status !== 'succeeded' || row.expiresAt.getTime() <= now.getTime()) throw new TextInputReviewUnavailableError();
    const result = row.result!;
    const entry = result.held?.[index];
    if (!entry) throw new TextInputReviewUnavailableError();
    if (entry.draftId && (await findSellerDraftsByIds(tx, seller.id, [entry.draftId])).length === 1) {
      return { draftId: entry.draftId, created: false };
    }
    const made = await createDraftFromLine(tx, {
      userId: ownerUserId, inputId, line: entry.line, parser: row.parser, locationId: result.locationId ?? null,
    });
    const held = [...result.held!];
    held[index] = { ...entry, draftId: made.draft.id };
    const next: SellerTextSubmissionResult = {
      ...result,
      held,
      draftIds: [...result.draftIds, made.draft.id],
      uncertain: made.uncertain ? [...result.uncertain, made.uncertain] : result.uncertain,
      priceChoices: entry.line.priceChoices
        ? [...(result.priceChoices ?? []), { draftId: made.draft.id, choices: entry.line.priceChoices }]
        : result.priceChoices,
    };
    await replaceSubmissionResult(tx, key, next);
    logOutcome({ inputId, outcome: 'held_draft_created', index });
    return { draftId: made.draft.id, created: true };
  });
}

// text-price-update §3.5: pending — still `proposed` and every offer at its expected revision; applied — confirmed;
// stale — refused, superseded or no longer confirmable.
async function priceProposalStates(database: Database, sellerId: string,
  proposals: NonNullable<SellerTextSubmissionResult['priceProposals']>): Promise<Map<string, PriceProposalState>> {
  const states = new Map<string, PriceProposalState>();
  if (proposals.length === 0) return states;
  const items = await findPriceUpdateItems(database, sellerId, proposals.map((proposal) => proposal.changeSetId));
  const removals = await findActiveRemovalsBySeller(database, sellerId);
  for (const proposal of proposals) {
    const own = items.filter((item) => item.changeSetId === proposal.changeSetId);
    if (own.length === 0) { states.set(proposal.changeSetId, 'stale'); continue; }
    if (own.every((item) => item.changeSetStatus === 'confirmed')) { states.set(proposal.changeSetId, 'applied'); continue; }
    let pending = true;
    for (const item of own) {
      const offer = await findOwnedOfferForManagement(database, item.offerId, sellerId);
      if (!offer || offer.revision !== item.expectedRevision || offer.status !== (item.action === 'activate_offer' ? 'inactive' : 'active')
        || (item.action === 'activate_offer' && removals.has(offer.cardId))) pending = false;
    }
    states.set(proposal.changeSetId, pending ? 'pending' : 'stale');
  }
  return states;
}

// All sections share the submission lock at proposal time. A blocked target rejects the entire request.
async function reviewBlocks(database: Database, ownerUserId: string, sellerId: string,
  result: SellerTextSubmissionResult, locale?: Locale) {
  type Block = NonNullable<HeldLineView['candidates'][number]['blocked']>;
  const blocks = new Map<string, Block>();
  const checks = await checkDuplicates(ownerUserId, result.locationId ?? null,
    (result.held ?? []).map((h) => duplicateInput(h.line)), { database, locale });
  const offered = new Set(checks.flatMap((c) => c.candidates.map((o) => o.offerId)));
  const absent = await matchAvailability(ownerUserId, result.locationId ?? null, result.unavailable ?? [], [], { database, locale });
  for (const c of absent.flatMap((v) => v.candidates)) if (offered.has(c.offerId)) blocks.set(c.offerId, { kind: 'contradiction' });
  const proposals = result.priceProposals ?? [];
  const states = await priceProposalStates(database, sellerId, [...proposals,
    ...(result.availabilityChangeSetIds ?? []).map((changeSetId) => ({ changeSetId, key: '', items: [] }))]);
  const tracked = await findPriceUpdateItems(database, sellerId, [...proposals.map((p) => p.changeSetId), ...(result.availabilityChangeSetIds ?? [])]);
  for (const item of tracked) {
    if (item.changeSetStatus !== 'proposed') continue;
    const pending = states.get(item.changeSetId) === 'pending';
    if (pending && !blocks.has(item.offerId)) blocks.set(item.offerId, { kind: 'pending', changeSetId: item.changeSetId, action: item.action });
  }
  return blocks;
}

const canonicalPrice = (price: string) => String(Number(price.replace(',', '.')));

// text-price-update §3.5 and implementation conditions 1–3: the server decides what may change. Under the submission row
// lock: the same set of changes returns its recorded proposal (reopened while pending; once confirmed, returned and
// never applied again); otherwise the chosen cards and prices are re-checked against the review record and the point's
// current cards, and one change set is created — or nothing at all.
export async function proposeTextPrices(
  ownerUserId: string,
  inputId: string,
  body: PriceProposalBody,
  dependencies: { database?: Database; clock?: () => Date; locale?: Locale } = {},
): Promise<{ changeSetId: string; state: 'pending' | 'applied'; created: boolean }> {
  const database = dependencies.database ?? getDatabase();
  const now = (dependencies.clock ?? (() => new Date()))();
  return database.transaction(async (transaction) => {
    const tx = transaction as unknown as Database;
    const seller = await findSellerByOwner(tx, ownerUserId);
    if (!seller) throw new TextInputReviewUnavailableError();
    const key: SubmissionKey = { sellerId: seller.id, requestId: inputId };
    const row = await findSubmission(tx, key, true);
    if (!row || row.status !== 'succeeded' || row.expiresAt.getTime() <= now.getTime()) throw new TextInputReviewUnavailableError();
    const result = row.result!;

    // Condition 1: the price must be this line's own (its bound price or one of its conflict choices).
    const notAllowed: number[] = [];
    for (const line of body.lines) {
      const heldLine = result.held?.[line.index]?.line;
      const input = heldLine ? duplicateInput(heldLine) : null;
      const noPriceReturn = line.action === 'activate_offer' && heldLine && (heldLine.price === null || heldLine.price.trim() === '') && !heldLine.priceChoices;
      if (noPriceReturn && line.price === null) continue;
      const allowed = !heldLine || !input ? [] : (heldLine.priceChoices && heldLine.priceChoices.length > 1)
        ? heldLine.priceChoices
        : (heldLine.price && !input.uncertain.includes('price') ? [heldLine.price] : []);
      if (line.price === null || !allowed.map(canonicalPrice).includes(canonicalPrice(line.price))) notAllowed.push(line.index);
    }
    if (notAllowed.length > 0) throw new TextPriceRejectedError('TEXT_PRICE_NOT_ALLOWED', notAllowed);

    // §3.4: at most one price per card.
    const byOffer = new Map<string, Set<string>>();
    for (const line of body.lines) {
      const price = line.price ?? (await findOwnedOfferForManagement(tx, line.offerId, seller.id))?.priceAmount ?? 'card';
      byOffer.set(line.offerId, (byOffer.get(line.offerId) ?? new Set()).add(price === 'card' ? price : canonicalPrice(price)));
    }
    const byLine = new Map<number, Set<string>>();
    for (const line of body.lines) byLine.set(line.index, (byLine.get(line.index) ?? new Set()).add(line.offerId));
    const multiple = [...byLine].filter(([, offers]) => offers.size > 1).map(([index]) => index);
    if (multiple.length > 0) throw new TextPriceRejectedError('TEXT_PRICE_LINE_CONFLICT', multiple);
    const clashing = body.lines.filter((line) => byOffer.get(line.offerId)!.size > 1).map((line) => line.index);
    if (clashing.length > 0) throw new TextPriceRejectedError('TEXT_PRICE_SAME_CARD_CONFLICT', clashing);

    // Condition 2: the exact set of (line, offer, price) is the idempotency key; a different set is its own proposal.
    const items = [...new Map(body.lines.map((line) => [`${line.index}:${line.offerId}`, { index: line.index, offerId: line.offerId, price: line.price === null ? 'card' : canonicalPrice(line.price), ...(line.action === 'activate_offer' ? { action: line.action } : {}) }])).values()]
      .sort((a, b) => a.index - b.index || a.offerId.localeCompare(b.offerId));
    const setKey = items.map((item) => `${item.index}:${item.offerId}:${item.price}${'action' in item ? ':activate_offer' : ''}`).join('|');
    const recorded = (result.priceProposals ?? []).filter((proposal) => proposal.key === setKey).at(-1);
    if (recorded) {
      const state = (await priceProposalStates(tx, seller.id, [recorded])).get(recorded.changeSetId);
      // Condition 3: confirmed → returned, never applied again; pending → reopened; stale → chosen again below.
      if (state === 'applied' || state === 'pending') return { changeSetId: recorded.changeSetId, state, created: false };
    }

    // §3.1 against the current cards of the point, and what the Seller saw.
    const lines = body.lines.map((line) => duplicateInput(result.held![line.index]!.line));
    const checks = await checkDuplicates(ownerUserId, result.locationId ?? null, lines, { database: tx, locale: dependencies.locale });
    const changed: number[] = [];
    const targets = new Map<string, { offerId: string; expectedRevision: number; price: string; action?: 'update_offer' | 'activate_offer' }>();
    const blocks = await reviewBlocks(tx, ownerUserId, seller.id, result, dependencies.locale);
    body.lines.forEach((line, k) => {
      const candidates = checks[k]!.candidates;
      const shown = new Set(line.shown.map((c) => `${c.offerId}:${c.revision}`));
      const present = new Set(candidates.map((c) => `${c.offerId}:${c.revision}`));
      const chosen = candidates.find((c) => c.offerId === line.offerId);
      const same = shown.size === present.size && [...shown].every((entry) => present.has(entry));
      const returning = line.action === 'activate_offer';
      if (!same || !chosen || blocks.has(line.offerId) || (returning ? !chosen.returnEligible : (!chosen.priceEligible || line.price === null || !priceDiffers(line.price, chosen)))) {
        changed.push(line.index);
        return;
      }
      targets.set(chosen.offerId, { offerId: chosen.offerId, expectedRevision: chosen.revision, price: line.price === null ? chosen.price!.amount : canonicalPrice(line.price), action: line.action });
    });
    if (changed.length > 0) throw new TextPriceChangedError(changed);

    let changeSetId: string;
    try {
      changeSetId = await createPriceUpdateChangeSet(tx, seller.id, [...targets.values()]);
    } catch (error) {
      if (error instanceof OfferChangedError) throw new TextPriceChangedError(body.lines.map((line) => line.index));
      throw error;
    }
    await replaceSubmissionResult(tx, key, {
      ...result,
      priceProposals: [...(result.priceProposals ?? []), { key: setKey, changeSetId, items: items.map((item) => ({ ...item, price: targets.get(item.offerId)!.price })) }],
    });
    logOutcome({ inputId, outcome: 'price_proposed', offers: targets.size });
    return { changeSetId, state: 'pending' as const, created: true };
  }).catch(async (error: unknown) => {
    // The failed proposal is fully rolled back; only the need for an explicit choice is remembered separately.
    if (error instanceof TextPriceChangedError) {
      await database.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        const seller = await findSellerByOwner(tx, ownerUserId);
        if (!seller) return;
        const key = { sellerId: seller.id, requestId: inputId };
        const row = await findSubmission(tx, key, true);
        if (row?.result) await replaceSubmissionResult(tx, key, { ...row.result,
          unselectedHeldIndices: [...new Set([...(row.result.unselectedHeldIndices ?? []), ...error.changed])] });
      });
    }
    throw error;
  });
}
