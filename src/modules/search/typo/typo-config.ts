// search-typo-suggestions (contract rev 3 §3.8): the correction switch and its bounds. Per process: with several Node
// processes every process has its own slots (there is no coordination between processes).
export type TypoCorrectionConfig = {
  // `SEARCH_AUTO_CORRECTION=off` turns the correction off without a deploy of code; anything else leaves it on.
  enabled: boolean;
  // How long the response waits for the correction pass; the pass itself may run longer (bounded by its own timeouts).
  budgetMs: number;
  // Correction passes in flight at once in this process; a slot is held until the underlying work has ended.
  maxPasses: number;
};

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function readTypoCorrectionConfig(env: Record<string, string | undefined> = process.env): TypoCorrectionConfig {
  return {
    enabled: env.SEARCH_AUTO_CORRECTION?.trim().toLowerCase() !== 'off',
    budgetMs: boundedInteger(env.SEARCH_CORRECTION_BUDGET_MS, 400, 20, 5000),
    maxPasses: boundedInteger(env.SEARCH_CORRECTION_MAX_PASSES, 3, 1, 20),
  };
}

// The work of one pass is bounded on its own (not by the response budget): the database statement of the verification
// search and the vocabulary load end within this time, so a slot is always released.
export const TYPO_WORK_STATEMENT_TIMEOUT_MS = 1000;
