import path from 'node:path';

// R2 guards (docs/slices/backup-restore/SLICE_CONTRACT.md §3.5): backup and restore must never reach the development stack.
// Pure functions: the CLI feeds them what it learned from `docker inspect` and the command line. Every refusal is a
// PreflightError and happens before anything is read from or written to a target.

export class PreflightError extends Error {
  readonly kind = 'preflight';
}

// Failure after a target was already modified. The target is NOT ready and must be cleaned up and recreated.
export class RuntimeFailure extends Error {
  readonly kind = 'runtime';
}

export const DEVELOPMENT_DATABASES = ['kaida', 'kaida_test'];
export const DEVELOPMENT_HOST_PORT = 5432;
// The file left in a photo directory while a restore is in progress or has failed. It is removed only after verification passed.
export const RESTORE_MARKER = '.restore-incomplete';

export type ContainerFacts = {
  name: string;
  running: boolean;
  hostPorts: number[];
  composeWorkingDir: string | undefined;
  database: string;
};

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function assertSafeContainer(facts: ContainerFacts, repoRoot: string): void {
  if (!facts.running) throw new PreflightError(`Container ${facts.name} is not running.`);
  if (facts.hostPorts.includes(DEVELOPMENT_HOST_PORT)) {
    throw new PreflightError(`Refusing: container ${facts.name} publishes host port ${DEVELOPMENT_HOST_PORT} (the development stack).`);
  }
  if (facts.composeWorkingDir !== undefined && path.resolve(facts.composeWorkingDir) === path.resolve(repoRoot)) {
    throw new PreflightError(`Refusing: container ${facts.name} belongs to the repository's default compose project (the development stack).`);
  }
  if (DEVELOPMENT_DATABASES.includes(facts.database)) {
    throw new PreflightError(`Refusing: database ${facts.database} is a development database.`);
  }
}

// Photo directories and bundles live outside the working copy: that rules out `.data/photos` and any other path in the repository.
export function assertOutsideRepository(target: string, repoRoot: string, what: string): void {
  if (isInside(repoRoot, target)) {
    throw new PreflightError(`Refusing: ${what} (${path.resolve(target)}) is inside the repository working copy.`);
  }
}
