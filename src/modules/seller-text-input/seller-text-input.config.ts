export const sellerTextInputModes = ['off', 'fake'] as const;

export type SellerTextInputMode = typeof sellerTextInputModes[number];

export type SellerTextInputEnvironment = Readonly<Record<string, string | undefined>>;

// `off` is default (PROJECT_RULES §10.1). `fake` is a deterministic network-free parser for tests and local demos.
export function readSellerTextInputMode(
  env: SellerTextInputEnvironment = process.env,
): SellerTextInputMode {
  const raw = env.SELLER_TEXT_INPUT;
  if (raw === undefined || raw === '') return 'off';
  if ((sellerTextInputModes as readonly string[]).includes(raw)) return raw as SellerTextInputMode;
  if (!invalidModeReported) {
    invalidModeReported = true;
    console.error('SELLER_TEXT_INPUT must be one of: off, fake; text input stays off');
  }
  return 'off';
}

let invalidModeReported = false;

export function isSellerTextInputEnabled(
  env: SellerTextInputEnvironment = process.env,
): boolean {
  return readSellerTextInputMode(env) !== 'off';
}
