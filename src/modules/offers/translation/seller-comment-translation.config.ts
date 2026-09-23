export const sellerCommentTranslatorModes = ['off', 'fake'] as const;

export type SellerCommentTranslatorMode = typeof sellerCommentTranslatorModes[number];

export type SellerCommentTranslationEnvironment = Readonly<Record<string, string | undefined>>;

// `off` is the default and the only mode every core flow must pass in (PROJECT_RULES §10.1).
// `fake` is a deterministic, network-free adapter for tests and demos. A real LLM adapter is added only for a
// KAIDA-hosted model or a provider the Product Owner has approved.
export function readSellerCommentTranslatorMode(
  env: SellerCommentTranslationEnvironment = process.env,
): SellerCommentTranslatorMode {
  const raw = env.SELLER_COMMENT_TRANSLATOR;
  if (raw === undefined || raw === '') return 'off';
  if ((sellerCommentTranslatorModes as readonly string[]).includes(raw)) return raw as SellerCommentTranslatorMode;
  // A misconfigured optional service degrades to `off` instead of failing Search or confirmation.
  if (!invalidModeReported) {
    invalidModeReported = true;
    console.error('SELLER_COMMENT_TRANSLATOR must be one of: off, fake; the translator stays off');
  }
  return 'off';
}

let invalidModeReported = false;

export function isSellerCommentTranslationEnabled(
  env: SellerCommentTranslationEnvironment = process.env,
): boolean {
  return readSellerCommentTranslatorMode(env) !== 'off';
}
