// search-typo-suggestions (contract rev 3 §3.8, §3.11): the lifecycle of a correction pass. At most `maxPasses` passes are in
// flight in this process. A pass takes its slot BEFORE it starts and gives it back only when the underlying work has really
// ended (in `finally`) — never when the response budget runs out; there is no queue, no waiting for a slot and no retry. A
// result that arrives after the budget is discarded. A late failure is caught here, never an unhandled rejection.

export type PassStatus = 'done' | 'timeout' | 'skipped' | 'failed';
export type PassOutcome<T> = { status: 'done'; value: T } | { status: Exclude<PassStatus, 'done'> };

let unfinishedPasses = 0;
export function unfinishedCorrectionPasses(): number {
  return unfinishedPasses;
}

export async function runCorrectionPass<T>(work: () => Promise<T>, budgetMs: number, maxPasses: number): Promise<PassOutcome<T>> {
  if (unfinishedPasses >= maxPasses) return { status: 'skipped' };
  unfinishedPasses += 1;
  let settled: Promise<PassOutcome<T>>;
  try {
    settled = work().then(
      (value) => ({ status: 'done' as const, value }),
      () => ({ status: 'failed' as const }),
    );
  } catch {
    unfinishedPasses -= 1;
    return { status: 'failed' };
  }
  // Always handled; the slot returns only here.
  const done = settled.finally(() => { unfinishedPasses -= 1; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<{ status: 'timeout' }>((resolve) => { timer = setTimeout(() => resolve({ status: 'timeout' }), budgetMs); });
  try {
    // After a timeout the late value of `done` goes nowhere: it is not stored, not returned and not used.
    return await Promise.race([done, budget]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
