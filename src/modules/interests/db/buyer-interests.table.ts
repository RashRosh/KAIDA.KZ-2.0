import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { products } from '../../catalog/db/products.table';
import { users } from '../../identity/db/users.table';

export const buyerInterests = pgTable('buyer_interests', {
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
}, (table) => [
  primaryKey({
    columns: [table.userId, table.productId],
    name: 'buyer_interests_user_product_pk',
  }),
]);
