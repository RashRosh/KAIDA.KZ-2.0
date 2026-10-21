import { resolveCurrentUser } from '../../identity/application/resolve-current-user';
import { isSellerTextInputEnabledFor, readSellerTextInputMode } from '../seller-text-input.config';

// Server pages: is the text channel shown to the user of this session? `fake` needs no user lookup; `real` checks the
// allowlist (seller-ai-text-real-parser §8). Any failure hides the channel; manual entry is unaffected.
export async function isTextInputEnabledForSession(sessionToken: string | undefined): Promise<boolean> {
  const mode = readSellerTextInputMode();
  if (mode !== 'real') return mode === 'fake';
  const user = await resolveCurrentUser(sessionToken).catch(() => null);
  return isSellerTextInputEnabledFor(user);
}
