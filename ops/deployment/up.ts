import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'dotenv';
import { checkEnvironment, formatFinding, hasErrors } from './preflight-rules';

// R3 `pnpm deploy:up`: the one supported way to start the reference stack (docs/ops/DEPLOYMENT.md).
//   1 offline preflight (host)  2 build images  3 database  4 migrate  5 Production KB import  6 online preflight  7 application
// Exit codes: 0 started · 1 usage · 2 refused before anything was started · 3 a step failed.

const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const USAGE = 'Usage: pnpm deploy:up --env-file <file outside the repository> [--tls-check]';

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('error', () => resolve(127));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function gitSha(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('git', ['rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    child.on('error', () => resolve('unknown'));
    child.on('close', () => resolve(out.trim() || 'unknown'));
  });
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { 'env-file': { type: 'string' }, 'tls-check': { type: 'boolean', default: false } }, strict: false });
  const envFile = typeof values['env-file'] === 'string' ? path.resolve(values['env-file']) : undefined;
  if (!envFile) { console.error(USAGE); return 1; }

  const repoRoot = path.resolve(DIRECTORY, '..', '..');
  const relative = path.relative(repoRoot, envFile);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    console.error('Refusing: the env file is inside the repository working copy; keep secrets outside it.');
    return 2;
  }

  let env: Record<string, string>;
  try {
    env = parse(readFileSync(envFile));
  } catch {
    console.error('The env file could not be read.');
    return 1;
  }

  const findings = checkEnvironment(env);
  for (const finding of findings) console.log(formatFinding(finding));
  if (hasErrors(findings)) { console.error('Preflight failed: nothing was started.'); return 2; }

  const processEnv = { ...process.env, KAIDA_GIT_SHA: await gitSha() };
  const files = ['-f', path.join(DIRECTORY, 'docker-compose.yml'), ...(values['tls-check'] ? ['-f', path.join(DIRECTORY, 'docker-compose.tls-check.yml')] : [])];
  const compose = (...args: string[]) => run('docker', ['compose', ...files, '--env-file', envFile, ...args], processEnv);

  const steps: Array<[string, string[]]> = [
    ['build tools', ['--profile', 'tools', 'build', 'tools']],
    ['build application', ['build', 'app']],
    ['start the database', ['up', '-d', '--wait', 'postgres']],
    ['apply migrations', ['--profile', 'tools', 'run', '--rm', 'tools', 'pnpm', 'db:migrate']],
    ['import the Production KB', ['--profile', 'tools', 'run', '--rm', 'tools', 'pnpm', 'db:import:production-kb']],
    ['online preflight', ['--profile', 'tools', 'run', '--rm', 'tools', 'pnpm', 'deploy:preflight']],
    ['start the application', ['up', '-d', '--wait', ...(values['tls-check'] ? ['app', 'tls-proxy'] : ['app'])]],
  ];
  for (const [name, args] of steps) {
    console.log(`\n== ${name}`);
    if ((await compose(...args)) !== 0) { console.error(`Step failed: ${name}.`); return 3; }
  }
  console.log('\nThe stack is up. Test OTP is active: private testing only, do not expose it.');
  return 0;
}

main().then((code) => { process.exitCode = code; });
