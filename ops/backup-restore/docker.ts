import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { PreflightError, RuntimeFailure, type ContainerFacts } from './guards';
import type { SnapshotHandle, SourceDatabase } from './backup';
import type { TargetDatabase } from './restore';
import type { MigrationFingerprint } from './manifest';

// R2: PostgreSQL reached through `docker exec` in the database container: the client version always equals the server's,
// no PostgreSQL install and no password are needed on the host (the local socket inside the container is trusted).
// Arguments are passed as an array, never through a shell.

type RunResult = { code: number; stdout: string; stderr: string };

function run(args: string[], options: { stdinFile?: string; stdoutFile?: string } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    if (options.stdoutFile) child.stdout.pipe(createWriteStream(options.stdoutFile));
    else child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.stdin.on('error', () => undefined);
    if (options.stdinFile) createReadStream(options.stdinFile).pipe(child.stdin);
    else child.stdin.end();
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }));
  });
}

// One line of tool output, trimmed: error texts may carry row values (constraint details), so only the headline is shown.
function headline(stderr: string): string {
  const line = stderr.split('\n').find((candidate) => /error/i.test(candidate)) ?? stderr.split('\n')[0] ?? '';
  return line.replace(/\s+/g, ' ').trim().slice(0, 160);
}

export async function inspectContainer(name: string): Promise<{ facts: Omit<ContainerFacts, 'database'>; user: string | undefined; database: string | undefined }> {
  const result = await run(['inspect', name]);
  if (result.code !== 0) throw new PreflightError(`Container ${name} was not found.`);
  const info = (JSON.parse(result.stdout) as Array<{
    Name: string;
    State: { Running: boolean };
    NetworkSettings: { Ports: Record<string, Array<{ HostPort: string }> | null> };
    Config: { Env: string[]; Labels: Record<string, string> };
  }>)[0];
  const env = new Map(info.Config.Env.map((entry) => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
  const hostPorts = Object.values(info.NetworkSettings.Ports).flatMap((bindings) => (bindings ?? []).map((binding) => Number(binding.HostPort)));
  return {
    facts: { name: info.Name.replace(/^\//, ''), running: info.State.Running, hostPorts, composeWorkingDir: info.Config.Labels['com.docker.compose.project.working_dir'] },
    user: env.get('POSTGRES_USER'),
    database: env.get('POSTGRES_DB'),
  };
}

const TABLE_ROWS_SQL = `(SELECT coalesce(json_object_agg(table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint), '{}'::json)
  FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')::text`;
const MIGRATIONS_SQL = `(SELECT json_build_object('count', count(*), 'lastHash', (SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 1)) FROM drizzle.__drizzle_migrations)::text`;
const PHOTO_IDS_SQL = `(SELECT coalesce(json_agg(id ORDER BY id), '[]'::json) FROM public.photos)::text`;
const VERSION_SQL = `current_setting('server_version')`;

export class DockerDatabase implements SourceDatabase, TargetDatabase {
  constructor(private readonly container: string, private readonly user: string, private readonly database: string) {}

  private psqlArgs(extra: string[]): string[] {
    return ['exec', '-i', this.container, 'psql', '-U', this.user, '-d', this.database, '-v', 'ON_ERROR_STOP=1', '-qAt', ...extra];
  }

  private async scalar(sql: string): Promise<string> {
    const result = await run(this.psqlArgs(['-c', `SELECT ${sql}`]));
    if (result.code !== 0) throw new RuntimeFailure(`psql failed: ${headline(result.stderr)}`);
    return result.stdout.trim();
  }

  async tableRows(): Promise<Record<string, number>> {
    return JSON.parse(await this.scalar(TABLE_ROWS_SQL)) as Record<string, number>;
  }

  async migrations(): Promise<MigrationFingerprint> {
    return JSON.parse(await this.scalar(MIGRATIONS_SQL)) as MigrationFingerprint;
  }

  async photoIds(): Promise<string[]> {
    return JSON.parse(await this.scalar(PHOTO_IDS_SQL)) as string[];
  }

  async describeNonEmpty(): Promise<string | null> {
    const facts = JSON.parse(await this.scalar(`json_build_object(
      'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')),
      'schemas', (SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT IN ('public', 'information_schema') AND schema_name NOT LIKE 'pg\\_%'),
      'extensions', (SELECT count(*) FROM pg_extension WHERE extname <> 'plpgsql'))::text`)) as { tables: number; schemas: number; extensions: number };
    if (facts.tables === 0 && facts.schemas === 0 && facts.extensions === 0) return null;
    return `${facts.tables} tables, ${facts.schemas} extra schemas, ${facts.extensions} extensions`;
  }

  async restoreDump(file: string): Promise<void> {
    const result = await run(['exec', '-i', this.container, 'pg_restore', '-U', this.user, '-d', this.database, '--no-owner', '--no-privileges', '--exit-on-error'], { stdinFile: file });
    if (result.code !== 0) throw new RuntimeFailure(`pg_restore failed (exit ${result.code}): ${headline(result.stderr)}`);
  }

  // One REPEATABLE READ transaction exports a snapshot; the dump, the counts and the photo list are all read at that instant.
  async openSnapshot(): Promise<SnapshotHandle> {
    const child: ChildProcessWithoutNullStreams = spawn('docker', this.psqlArgs([]), { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    let stderr = '';
    let exited = false;
    const waiters: Array<() => void> = [];
    child.stdout.on('data', (chunk: Buffer) => { buffer += chunk.toString('utf8'); waiters.splice(0).forEach((wake) => wake()); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.on('close', () => { exited = true; waiters.splice(0).forEach((wake) => wake()); });
    child.stdin.on('error', () => undefined);
    const ask = async (expression: string): Promise<string> => {
      child.stdin.write(`SELECT '<<' || ${expression} || '>>';\n`);
      for (;;) {
        const match = /<<([\s\S]*?)>>\n/.exec(buffer);
        if (match) {
          buffer = buffer.slice(match.index + match[0].length);
          return match[1];
        }
        if (exited) throw new RuntimeFailure(`The database session ended: ${headline(stderr)}`);
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
    };
    const close = async () => {
      if (!exited) child.stdin.end('COMMIT;\n\\q\n');
      await new Promise<void>((resolve) => { if (exited) resolve(); else waiters.push(resolve); });
    };
    try {
      child.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n');
      const snapshotId = await ask('pg_export_snapshot()');
      const [tableRows, migrations, photoIds, postgresVersion] = [
        JSON.parse(await ask(TABLE_ROWS_SQL)) as Record<string, number>,
        JSON.parse(await ask(MIGRATIONS_SQL)) as MigrationFingerprint,
        JSON.parse(await ask(PHOTO_IDS_SQL)) as string[],
        await ask(VERSION_SQL),
      ];
      return {
        tableRows,
        migrations,
        photoIds,
        postgresVersion,
        dumpTo: async (file: string) => {
          const result = await run(['exec', this.container, 'pg_dump', '-U', this.user, '-d', this.database, '-Fc', '--no-owner', '--no-privileges', `--snapshot=${snapshotId}`], { stdoutFile: file });
          if (result.code !== 0) throw new RuntimeFailure(`pg_dump failed (exit ${result.code}): ${headline(result.stderr)}`);
        },
        close,
      };
    } catch (error) {
      await close();
      if (/drizzle\.__drizzle_migrations|public\.photos/.test(stderr)) {
        throw new PreflightError('This does not look like a KAIDA database (migration or photo tables are missing).');
      }
      throw error;
    }
  }
}
