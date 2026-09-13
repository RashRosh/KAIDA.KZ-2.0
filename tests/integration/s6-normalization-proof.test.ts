import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDatabase } from './database';

const NORMALIZED_KEY = (valueSql: string) => `
  normalize(
    casefold(
      normalize(btrim(${valueSql}), NFC)
        COLLATE pg_catalog.pg_unicode_fast
    ),
    NFC
  ) COLLATE pg_catalog.pg_unicode_fast
`;

describe.sequential('S6 normalization contract against PostgreSQL 18', () => {
  let connection: Awaited<ReturnType<typeof connectTestDatabase>>;
  let client: PoolClient;

  beforeAll(async () => {
    connection = await connectTestDatabase();
    client = await connection.pool.connect();
  });

  afterAll(async () => {
    if (client) client.release();
    if (connection) await connection.pool.end();
  });

  async function normalizedEquals(left: string, right: string) {
    const result = await client.query<{ equal: boolean }>(
      `SELECT (${NORMALIZED_KEY('$1::text')}) = (${NORMALIZED_KEY('$2::text')}) AS equal`,
      [left, right],
    );
    return result.rows[0]?.equal;
  }

  it('runs on PostgreSQL 18 UTF8 with explicit pg_catalog.pg_unicode_fast semantics', async () => {
    const environment = await client.query<{
      version_num: number;
      version: string;
      encoding: string;
    }>(
      `SELECT
         current_setting('server_version_num')::int AS version_num,
         current_setting('server_version') AS version,
         current_setting('server_encoding') AS encoding`,
    );

    expect(environment.rows[0]?.version_num).toBeGreaterThanOrEqual(180000);
    expect(environment.rows[0]?.version_num).toBeLessThan(190000);
    expect(environment.rows[0]?.encoding).toBe('UTF8');

    const collation = await client.query<{
      schema_name: string;
      collname: string;
      collprovider: string;
      collisdeterministic: boolean;
      colllocale: string;
    }>(
      `SELECT
         n.nspname AS schema_name,
         c.collname,
         c.collprovider,
         c.collisdeterministic,
         c.colllocale
       FROM pg_catalog.pg_collation AS c
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.collnamespace
       WHERE n.nspname = 'pg_catalog'
         AND c.collname = 'pg_unicode_fast'`,
    );

    expect(collation.rows).toEqual([
      {
        schema_name: 'pg_catalog',
        collname: 'pg_unicode_fast',
        collprovider: 'b',
        collisdeterministic: true,
        colllocale: 'PG_UNICODE_FAST',
      },
    ]);

    const expressionCollation = await client.query<{ collation: string | null }>(
      `SELECT pg_collation_for(${NORMALIZED_KEY("'БАРАНИНА'::text")}) AS collation`,
    );

    expect(expressionCollation.rows[0]?.collation).toContain('pg_unicode_fast');
  });

  it('implements trim -> NFC -> Unicode case folding -> NFC without extra normalization', async () => {
    await expect(normalizedEquals('БАРАНИНА', 'баранина')).resolves.toBe(true);
    await expect(normalizedEquals('   Баранина   ', 'баранина')).resolves.toBe(true);
    await expect(normalizedEquals('й', 'и\u0306')).resolves.toBe(true);

    await expect(normalizedEquals('е', 'ё')).resolves.toBe(false);
    await expect(normalizedEquals('мясо барана', 'мясо  барана')).resolves.toBe(false);
    await expect(normalizedEquals('баранина', 'баранина!')).resolves.toBe(false);
  });

  it('is valid in a UNIQUE expression index and blocks a normalized duplicate canonical Product', async () => {
    await client.query('DROP TABLE IF EXISTS pg_temp.s6_normalization_proof_products');
    await client.query(`
      CREATE TEMP TABLE s6_normalization_proof_products (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name text NOT NULL
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX s6_normalization_proof_name_uq
      ON s6_normalization_proof_products (
        (${NORMALIZED_KEY('name')})
      )
    `);

    const index = await client.query<{ indexdef: string }>(
      `SELECT indexdef
       FROM pg_catalog.pg_indexes
       WHERE schemaname LIKE 'pg_temp_%'
         AND tablename = 's6_normalization_proof_products'
         AND indexname = 's6_normalization_proof_name_uq'`,
    );

    expect(index.rows).toHaveLength(1);
    const indexDefinition = index.rows[0]?.indexdef.toLowerCase();
    expect(indexDefinition).toContain('pg_unicode_fast');
    expect(indexDefinition).toContain('casefold');
    expect(indexDefinition).toContain('normalize');

    await client.query(
      'INSERT INTO s6_normalization_proof_products (name) VALUES ($1)',
      ['Баранина'],
    );

    let duplicateError: unknown;
    try {
      await client.query(
        'INSERT INTO s6_normalization_proof_products (name) VALUES ($1)',
        ['   БАРАНИНА   '],
      );
    } catch (error) {
      duplicateError = error;
    }

    expect(duplicateError).toMatchObject({ code: '23505' });

    const rows = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM s6_normalization_proof_products',
    );
    expect(rows.rows[0]?.count).toBe('1');

    await client.query('DROP TABLE s6_normalization_proof_products');
  });
});
