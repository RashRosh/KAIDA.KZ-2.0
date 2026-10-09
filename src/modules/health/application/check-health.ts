// R3: container health. "Healthy" = the process answers and the database answers a trivial query within the budget.
// The result carries no detail on purpose: the endpoint is unauthenticated and must not describe the system.
export type HealthResult = { ok: boolean };

export async function checkHealth(ping: () => Promise<unknown>, timeoutMs = 2000): Promise<HealthResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
