// seller-ai-text-real-parser E2E settings shared by playwright.config.ts and seller-text-real-parser.spec.ts.
export const REPLAY_STUB_PORT = 3199;
export const REAL_PARSER_BASE_URL = 'http://127.0.0.1:3101';

export function realParserPhone(projectName: string, slot: number): string {
  return `+770000${projectName === 'mobile' ? '495' : '496'}0${slot}`;
}

// Allowlisted for `real` mode on the 3101 server; slot 9 of each project stays NOT allowlisted.
export const REAL_PARSER_E2E_PHONES = ['mobile', 'desktop'].flatMap((project) => [1, 2, 3].map((slot) => realParserPhone(project, slot)));
