import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { productCategories } from './product-categories.table';
import { products } from './products.table';

export const productCategoryLinks = pgTable('product_category_links', {
  productId: uuid('product_id').primaryKey().references(() => products.id),
  categoryCode: text('category_code').notNull().references(() => productCategories.code),
});
