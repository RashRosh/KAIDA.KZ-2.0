import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const kbPackageInstall = pgTable('kb_package_install', {
  id: boolean('id').default(true).primaryKey(),
  packageName: text('package_name').notNull(),
  packageVersion: text('package_version').notNull(),
  packageSchemaVersion: integer('package_schema_version').notNull(),
  sourceCheckpointTag: text('source_checkpoint_tag').notNull(),
  sourceCommitSha: text('source_commit_sha').notNull(),
  manifestSha256: text('manifest_sha256').notNull(),
  productsCount: integer('products_count').notNull(),
  aliasesCount: integer('aliases_count').notNull(),
  categoriesCount: integer('categories_count').notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('kb_package_install_singleton', sql`${table.id} = true`),
  check('kb_package_install_schema_positive', sql`${table.packageSchemaVersion} > 0`),
  check('kb_package_install_counts_non_negative', sql`${table.productsCount} >= 0 AND ${table.aliasesCount} >= 0 AND ${table.categoriesCount} >= 0`),
  check('kb_package_install_source_commit_sha_format', sql`${table.sourceCommitSha} ~ '^[0-9a-f]{40}$'`),
  check('kb_package_install_manifest_sha256_format', sql`${table.manifestSha256} ~ '^[0-9a-f]{64}$'`),
]);
