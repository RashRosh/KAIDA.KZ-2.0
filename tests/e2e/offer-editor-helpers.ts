import { expect, type Page } from '@playwright/test';

// seller-offer-editor: the S-06 form (and the S-07 point step for create) is one dialog over the cabinet page.
export function offerEditor(page: Page) {
  return page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^(Далее|Продолжить|Әрі қарай|Жалғастыру|Повторить|Қайталау|Сохраняем черновик…)$/ }) });
}

export type OfferFields = { product?: string; price?: string; unit?: 'kg' | 'piece' | 'liter' | 'package' | ''; comment?: string };

export async function fillOfferFields(page: Page, fields: OfferFields) {
  const dialog = offerEditor(page);
  if (fields.product !== undefined) await dialog.getByRole('textbox', { name: 'Товар', exact: true }).fill(fields.product);
  if (fields.price !== undefined) await dialog.getByRole('textbox', { name: 'Цена', exact: true }).fill(fields.price);
  if (fields.unit !== undefined) await dialog.getByRole('combobox', { name: 'Единица', exact: true }).selectOption(fields.unit);
  if (fields.comment !== undefined) await dialog.getByRole('textbox', { name: /^Комментарий/ }).fill(fields.comment);
}

// Opens «Добавить товар», fills the form, picks the point (or keeps the only one) and lands on the review page.
export async function proposeNewOffer(page: Page, fields: OfferFields & { point?: string }, start = '/seller/offers') {
  await page.goto(start);
  await page.getByRole('link', { name: 'Добавить товар' }).first().click();
  const dialog = offerEditor(page);
  await expect(dialog).toBeVisible();
  await fillOfferFields(page, fields);
  await dialog.getByRole('button', { name: 'Далее' }).click();
  await expect(dialog.getByRole('heading', { name: 'Где продаёте?' })).toBeVisible();
  if (fields.point) await dialog.getByRole('radio', { name: new RegExp(fields.point.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).check();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
}

// Opens «Изменить» on the card, changes the given fields and lands on the review page.
export async function proposeOfferEdit(page: Page, card: ReturnType<Page['getByRole']>, fields: Omit<OfferFields, 'product'>) {
  await card.getByRole('link', { name: 'Изменить', exact: true }).click();
  const dialog = offerEditor(page);
  await expect(dialog.getByRole('heading', { name: 'Изменить предложение' })).toBeVisible();
  await fillOfferFields(page, fields);
  await dialog.getByRole('button', { name: 'Далее' }).click();
  await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
}
