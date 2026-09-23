import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { testDatabaseUrl } from './database';

type MigrationDatabase = ReturnType<typeof drizzle>;

type MigrationTestDatabaseOptions = {
  name: string;
  maxConnections?: number;
};

function quoteTestDatabaseName(name: string) {
  if (!/^kaida_[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Unsafe migration test database name: ${name}`);
  }
  return `"${name}"`;
}

async function closeTargetPool(pool: Pool, admin: Pool, name: string) {
  const expectedRemovals = pool.totalCount;
  let removed = 0;
  let resolveRemoved: (() => void) | undefined;
  const removedPromise = expectedRemovals === 0
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveRemoved = resolve;
      });

  const onRemove = () => {
    removed += 1;
    if (removed === expectedRemovals) resolveRemoved?.();
  };

  if (expectedRemovals > 0) pool.on('remove', onRemove);
  try {
    await pool.end();
    await removedPromise;
  } finally {
    if (expectedRemovals > 0) pool.off('remove', onRemove);
  }

  const remaining = await admin.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = $1',
    [name],
  );
  if (remaining.rows[0]?.count !== '0') {
    throw new Error(
      `Migration test target ${name} still has active connections after pool shutdown: ${remaining.rows[0]?.count ?? 'unknown'}`,
    );
  }
}

export async function withMigrationTestDatabase<T>(
  options: MigrationTestDatabaseOptions,
  run: (pool: Pool, db: MigrationDatabase) => Promise<T>,
): Promise<T> {
  const guardedUrl = testDatabaseUrl();
  const name = options.name;
  const quotedName = quoteTestDatabaseName(name);
  const developmentUrl = new URL(process.env.DATABASE_URL!);

  if (decodeURIComponent(developmentUrl.pathname) === `/${name}`) {
    throw new Error(`Development database must never be migration test target ${name}`);
  }

  const admin = new Pool({ connectionString: guardedUrl, max: 1 });
  let target: Pool | undefined;

  try {
    const version = Number(
      (await admin.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version,
    );
    if (version < 180000 || version >= 190000) {
      throw new Error('Migration upgrade tests require PostgreSQL 18');
    }

    // Recovery from a previously aborted test run. No current target pool exists yet.
    await admin.query(`DROP DATABASE IF EXISTS ${quotedName} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${quotedName}`);

    const targetUrl = new URL(guardedUrl);
    targetUrl.pathname = `/${name}`;
    if (decodeURIComponent(targetUrl.pathname) !== `/${name}`) {
      throw new Error(`Unsafe migration test database target: ${name}`);
    }

    target = new Pool({
      connectionString: targetUrl.toString(),
      max: options.maxConnections ?? 4,
    });

    return await run(target, drizzle({ client: target }));
  } finally {
    if (target) await closeTargetPool(target, admin, name);
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${quotedName}`);
    } finally {
      await admin.end();
    }
  }
}

// offer-price-unit (0013) replaces legacy free-text price_unit with a structured code plus custom value.
// Older upgrade tests compare full rows, so they state the expected mapping explicitly through this helper.
export function withStructuredPriceUnit<T extends Record<string, unknown>>(legacyRow: T, code: string | null, value: string | null = null) {
  const { price_unit: _legacy, ...rest } = legacyRow;
  void _legacy;
  return { ...rest, price_unit_code: code, price_unit_value: value };
}
