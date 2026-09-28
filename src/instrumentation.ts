export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { translateBacklogOnStartup } = await import('./modules/offers/translation/seller-comment-translation.runtime');
  // Not awaited: the server must become ready without waiting for the translator.
  void translateBacklogOnStartup();
  // actuality-reminders: the reminder job every 15 minutes (only when push keys are set).
  const { startReminderScheduler } = await import('./modules/reminders/application/reminder-scheduler');
  startReminderScheduler();
}
