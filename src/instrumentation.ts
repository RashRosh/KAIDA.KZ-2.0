export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { translateBacklogOnStartup } = await import('./modules/offers/translation/seller-comment-translation.runtime');
  // Not awaited: the server must become ready without waiting for the translator.
  void translateBacklogOnStartup();
}
