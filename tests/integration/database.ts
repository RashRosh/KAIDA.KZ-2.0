import 'dotenv/config';
import { createDatabase } from '../../src/db/client';

export function testDatabaseUrl(env: { DATABASE_URL?: string; TEST_DATABASE_URL?: string } = {
  DATABASE_URL: process.env.DATABASE_URL,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
}): string {
  const testUrl = env.TEST_DATABASE_URL;
  const developmentUrl = env.DATABASE_URL;
  if (!testUrl || !developmentUrl) throw new Error('Both DATABASE_URL and TEST_DATABASE_URL are required');
  const test = new URL(testUrl);
  const development = new URL(developmentUrl);
  if (!['postgres:', 'postgresql:'].includes(test.protocol) ||
      decodeURIComponent(test.pathname) !== '/kaida_test' ||
      decodeURIComponent(development.pathname) === '/kaida_test') {
    throw new Error('Tests require a dedicated kaida_test database, separate from DATABASE_URL');
  }
  return testUrl;
}

export async function connectTestDatabase() {
  const connection = createDatabase(testDatabaseUrl());
  try {
    const result = await connection.pool.query<{ name: string; version: number }>(
      "SELECT current_database() AS name, current_setting('server_version_num')::int AS version",
    );
    const row = result.rows[0];
    if (row?.name !== 'kaida_test' || row.version < 180000 || row.version >= 190000) {
      throw new Error('Integration tests require real PostgreSQL 18 and kaida_test');
    }
    return connection;
  } catch (error) {
    await connection.pool.end();
    throw error;
  }
}
