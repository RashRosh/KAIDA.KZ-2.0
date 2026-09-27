import { expect, type Page } from '@playwright/test';

// seller-showcase-editor: the card editor (AI-S09 · AI off) is one dialog over «Моя витрина».
export function offerEditor(page: Page) {
  return page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^(Проверить и опубликовать|Проверить и сохранить|Тексеру және жариялау|Тексеру және сақтау|Повторить|Қайталау|Отправляем…)$/ }) });
}

export type OfferFields = { product?: string; price?: string; unit?: 'kg' | 'piece' | 'liter' | 'package' | ''; comment?: string };

const unitNames = { kg: /^кг/, piece: /^шт/, liter: /^л/, package: /^упак/ } as const;

export async function chooseUnit(page: Page, unit: keyof typeof unitNames) {
  const dialog = offerEditor(page);
  await dialog.getByRole('button', { name: /^Цена за/ }).click();
  await page.getByRole('dialog', { name: 'Цена за' }).getByRole('button', { name: unitNames[unit] }).click();
}

// The unit is required now: an omitted or empty unit is filled with «кг».
export async function fillOfferFields(page: Page, fields: OfferFields) {
  const dialog = offerEditor(page);
  if (fields.product !== undefined) await dialog.getByRole('combobox', { name: 'Название товара' }).fill(fields.product);
  if (fields.price !== undefined) await dialog.getByRole('textbox', { name: 'Цена', exact: true }).fill(fields.price);
  if (fields.unit !== undefined) await chooseUnit(page, fields.unit === '' ? 'kg' : fields.unit);
  if (fields.comment !== undefined) await dialog.getByRole('textbox', { name: /^Комментарий/ }).fill(fields.comment);
}

// «Сформировать карточки товаров» → «Заполнить вручную»: the empty card editor.
export async function openNewCard(page: Page, start = '/seller') {
  await page.goto(start);
  await page.getByRole('button', { name: 'Сформировать карточки товаров' }).first().click();
  await page.getByRole('button', { name: /^Заполнить вручную/ }).click();
  const dialog = offerEditor(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

// Opens a new card, fills it, chooses the point (or keeps the only one) and lands on the review page.
export async function proposeNewOffer(page: Page, fields: OfferFields & { point?: string }, start = '/seller') {
  const dialog = await openNewCard(page, start);
  await fillOfferFields(page, { ...fields, unit: fields.unit ?? 'kg' });
  if (fields.point) await dialog.getByRole('checkbox', { name: new RegExp(fields.point.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).check();
  await dialog.getByRole('button', { name: 'Проверить и опубликовать' }).click();
  await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
}

// A showcase card of the given product name.
export function showcaseCard(page: Page, name: string | RegExp) {
  return page.getByRole('article').filter({ has: page.getByRole('button', { name }) });
}

// Opens the card screen and «Изменить» (one point) or «Изменить во всех точках», changes fields, lands on review.
export async function proposeOfferEdit(page: Page, card: ReturnType<Page['getByRole']>, fields: Omit<OfferFields, 'product'>) {
  await card.getByRole('button').first().click();
  await page.getByRole('button', { name: /^(Изменить|Изменить во всех точках)$/ }).click();
  const dialog = offerEditor(page);
  await expect(dialog.getByRole('heading', { name: 'Изменить карточку' })).toBeVisible();
  await fillOfferFields(page, fields);
  await dialog.getByRole('button', { name: 'Проверить и сохранить' }).click();
  await expect(page).toHaveURL(/\/seller\/change-sets\/[0-9a-f-]+(\?.*)?$/);
}

// The publish button of the review page (card with or without photos).
export const publishButton = /^(Опубликовать|Опубликовать без фото|Жариялау|Фотосыз жариялау)$/;
