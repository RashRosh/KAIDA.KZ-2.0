// stage #5 (Issue #12): ranking weights are server-side policy, not code constants and not a client parameter.
// The buyer UI and the public Search API pass only the sort mode; the server maps the mode onto the current policy
// through this module. It is the minimal SearchRankingPolicy seam of the slice contract §2.3: ranking/scoring
// consumes an already validated policy and never knows the source of the values, so a later DB/Backoffice-managed
// source can replace this config source without touching the buyer UI, the public request contract or the
// scoring/ranking functions. No generic configuration framework is built here.

export type SearchSortMode = 'actuality' | 'distance';

export type SearchRankingWeights = { freshnessWeight: number; distanceWeight: number };

export type SearchRankingPolicy = Record<SearchSortMode, SearchRankingWeights>;

export const SEARCH_RANKING_POLICY_DEFAULTS: SearchRankingPolicy = {
  actuality: { freshnessWeight: 0.7, distanceWeight: 0.3 },
  distance: { freshnessWeight: 0.3, distanceWeight: 0.7 },
};

export type SearchRankingPolicyEnvironment = Readonly<Record<string, string | undefined>>;

export function weightsSumToOne(weights: SearchRankingWeights): boolean {
  return Math.abs(weights.freshnessWeight + weights.distanceWeight - 1) <= 1e-9;
}

function parseWeight(raw: string, source: string): number {
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid search ranking weight "${raw}" in ${source}`);
  }
  return value;
}

function readModeWeights(env: SearchRankingPolicyEnvironment, mode: SearchSortMode): SearchRankingWeights {
  const raw = env[`SEARCH_RANKING_WEIGHTS_${mode.toUpperCase()}`];
  if (raw === undefined || raw === '') return SEARCH_RANKING_POLICY_DEFAULTS[mode];
  const parts = raw.split(',');
  if (parts.length !== 2) throw new Error(`Search ranking weights in SEARCH_RANKING_WEIGHTS_${mode.toUpperCase()} must be "freshness,distance"`);
  const weights = { freshnessWeight: parseWeight(parts[0], `SEARCH_RANKING_WEIGHTS_${mode.toUpperCase()}`), distanceWeight: parseWeight(parts[1], `SEARCH_RANKING_WEIGHTS_${mode.toUpperCase()}`) };
  if (!weightsSumToOne(weights)) throw new Error(`Search ranking weights of the "${mode}" mode must sum to 1`);
  return weights;
}

// Missing configuration → deterministic MVP defaults; explicitly supplied invalid configuration → fail-fast.
export function readSearchRankingPolicy(env: SearchRankingPolicyEnvironment = process.env): SearchRankingPolicy {
  return {
    actuality: readModeWeights(env, 'actuality'),
    distance: readModeWeights(env, 'distance'),
  };
}
