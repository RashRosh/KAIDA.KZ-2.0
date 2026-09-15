import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from './client';
import { locations, offers, products, sellers } from './schema';
import { seedDatabase, seedIds } from './seed';

const demoProductIds = {
  honey: '51000000-0000-4000-8000-000000000003',
  potato: '51000000-0000-4000-8000-000000000004',
  kumis: '51000000-0000-4000-8000-000000000005',
  apple: '51000000-0000-4000-8000-000000000006',
  cheese: '51000000-0000-4000-8000-000000000007',
  curd: '51000000-0000-4000-8000-000000000008',
  tomato: '51000000-0000-4000-8000-000000000009',
  cucumber: '51000000-0000-4000-8000-000000000010',
  strawberry: '51000000-0000-4000-8000-000000000011',
  raspberryJam: '51000000-0000-4000-8000-000000000012',
} as const;

const sellerId = (index: number) => `52000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const locationId = (index: number) => `53000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const offerId = (index: number) => `54000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const demoProducts = [
  { id: seedIds.lambProduct, name: 'Баранина' },
  { id: seedIds.beefProduct, name: 'Говядина' },
  { id: demoProductIds.honey, name: 'Мёд' },
  { id: demoProductIds.potato, name: 'Картофель' },
  { id: demoProductIds.kumis, name: 'Кумыс' },
  { id: demoProductIds.apple, name: 'Яблоки' },
  { id: demoProductIds.cheese, name: 'Домашний сыр' },
  { id: demoProductIds.curd, name: 'Творог' },
  { id: demoProductIds.tomato, name: 'Помидоры' },
  { id: demoProductIds.cucumber, name: 'Огурцы' },
  { id: demoProductIds.strawberry, name: 'Клубника' },
  { id: demoProductIds.raspberryJam, name: 'Варенье малиновое' },
] as const;

const demoSellers = [
  {
    id: sellerId(1), displayName: 'Асыл Ет — демо', ownerUserId: null,
    contactPhoneE164: '+70000000001', whatsappPhoneE164: '+70000000001',
    telegramUsername: 'asyl_et_demo', instagramUsername: 'asyl.et.demo',
  },
  {
    id: sellerId(2), displayName: 'Ферма Көкжайлау — демо', ownerUserId: null,
    contactPhoneE164: '+70000000002', whatsappPhoneE164: null,
    telegramUsername: null, instagramUsername: null,
  },
  {
    id: sellerId(3), displayName: 'Бал Ата — демо', ownerUserId: null,
    contactPhoneE164: null, whatsappPhoneE164: '+70000000003',
    telegramUsername: 'bal_ata_demo', instagramUsername: null,
  },
  {
    id: sellerId(4), displayName: 'Дача у Сауле — демо', ownerUserId: null,
    contactPhoneE164: null, whatsappPhoneE164: null,
    telegramUsername: null, instagramUsername: null,
  },
  {
    id: sellerId(5), displayName: 'Сүт & Co — демо', ownerUserId: null,
    contactPhoneE164: '+70000000005', whatsappPhoneE164: '+70000000005',
    telegramUsername: null, instagramUsername: null,
  },
  {
    id: sellerId(6), displayName: 'Алатау Фермер — демо', ownerUserId: null,
    contactPhoneE164: null, whatsappPhoneE164: null,
    telegramUsername: null, instagramUsername: 'alatau.farmer.demo',
  },
  {
    id: sellerId(7), displayName: 'Зелёная грядка — демо', ownerUserId: null,
    contactPhoneE164: null, whatsappPhoneE164: null,
    telegramUsername: null, instagramUsername: null,
  },
  {
    id: sellerId(8), displayName: 'Домашние заготовки — демо', ownerUserId: null,
    contactPhoneE164: null, whatsappPhoneE164: '+70000000008',
    telegramUsername: 'home_jars_demo', instagramUsername: 'home.jars.demo',
  },
  {
    id: sellerId(9), displayName: 'Яблочный сад — демо', ownerUserId: null,
    contactPhoneE164: '+70000000009', whatsappPhoneE164: '+70000000009',
    telegramUsername: 'apple_garden_demo', instagramUsername: 'apple.garden.demo',
  },
  {
    id: sellerId(10), displayName: 'Медеу Маркет — демо', ownerUserId: null,
    contactPhoneE164: '+70000000010', whatsappPhoneE164: null,
    telegramUsername: null, instagramUsername: null,
  },
  {
    id: sellerId(11), displayName: 'Береке — демо', ownerUserId: null,
    contactPhoneE164: null, whatsappPhoneE164: null,
    telegramUsername: null, instagramUsername: null,
  },
  {
    id: sellerId(12), displayName: 'Тау өнімдері — демо', ownerUserId: null,
    contactPhoneE164: null, whatsappPhoneE164: '+70000000012',
    telegramUsername: 'tau_onim_demo', instagramUsername: null,
  },
] as const;

const demoLocations = [
  { id: locationId(1), sellerId: sellerId(1), name: 'Зелёный базар — демо 1', addressText: 'Алматы, демо-павильон 11', type: 'pavilion', latitude: 43.2631, longitude: 76.9292 },
  { id: locationId(2), sellerId: sellerId(2), name: 'Фермерская лавка — демо 2', addressText: 'Алматы, демо-точка на Абая', type: 'shop', latitude: 43.2387, longitude: 76.8974 },
  { id: locationId(3), sellerId: sellerId(3), name: 'Медовая точка — демо 3', addressText: 'Алматы, демо-ряд 7', type: 'market', latitude: 43.2465, longitude: 76.9417 },
  { id: locationId(4), sellerId: sellerId(4), name: 'Домашняя точка — демо 4', addressText: 'Алматы, демо-адрес в Алмалинском районе', type: 'home', latitude: 43.2451, longitude: 76.9132 },
  { id: locationId(5), sellerId: sellerId(5), name: 'Молочная лавка — демо 5', addressText: 'Алматы, демо-магазин 5', type: 'shop', latitude: 43.2308, longitude: 76.9121 },
  { id: locationId(6), sellerId: sellerId(6), name: 'Фермерский павильон — демо 6', addressText: 'Алматы, демо-павильон 6', type: 'pavilion', latitude: 43.2249, longitude: 76.9431 },
  { id: locationId(7), sellerId: sellerId(7), name: 'Овощная точка — демо 7', addressText: 'Алматы, демо-рынок 7', type: 'market', latitude: 43.2568, longitude: 76.9078 },
  { id: locationId(8), sellerId: sellerId(8), name: 'Заготовки — демо 8', addressText: 'Алматы, демо-домашняя точка 8', type: 'home', latitude: 43.2324, longitude: 76.9284 },
  { id: locationId(9), sellerId: sellerId(9), name: 'Фруктовая лавка — демо 9', addressText: 'Алматы, демо-магазин 9', type: 'shop', latitude: 43.2496, longitude: 76.9562 },
  { id: locationId(10), sellerId: sellerId(10), name: 'Медеу Маркет — демо 10', addressText: 'Алматы, демо-точка 10', type: 'shop', latitude: 43.2362, longitude: 76.9614 },
  { id: locationId(11), sellerId: sellerId(11), name: 'Береке базар — демо 11', addressText: 'Алматы, демо-ряд 11', type: 'market', latitude: 43.2701, longitude: 76.9149 },
  { id: locationId(12), sellerId: sellerId(12), name: 'Тау өнімдері — демо 12', addressText: 'Алматы, демо-павильон 12', type: 'pavilion', latitude: 43.2186, longitude: 76.9215 },
] as const;

type DemoOffer = {
  id: string;
  productId: string;
  sellerIndex: number;
  priceAmount: string | null;
  priceCurrency: 'KZT' | null;
  priceUnit: string | null;
  sellerComment: string | null;
};

const demoOffers: DemoOffer[] = [
  { id: offerId(1), productId: seedIds.lambProduct, sellerIndex: 1, priceAmount: '4200.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Свежая разделка утром.' },
  { id: offerId(2), productId: seedIds.lambProduct, sellerIndex: 2, priceAmount: '3950.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Мякоть и мясо на кости.' },
  { id: offerId(3), productId: seedIds.lambProduct, sellerIndex: 3, priceAmount: null, priceCurrency: null, priceUnit: null, sellerComment: 'Цена зависит от части туши.' },
  { id: offerId(4), productId: seedIds.lambProduct, sellerIndex: 4, priceAmount: '4500.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: null },
  { id: offerId(5), productId: seedIds.lambProduct, sellerIndex: 6, priceAmount: '4100.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Есть небольшие наборы.' },

  { id: offerId(6), productId: seedIds.beefProduct, sellerIndex: 1, priceAmount: '4800.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Охлаждённая говядина.' },
  { id: offerId(7), productId: seedIds.beefProduct, sellerIndex: 6, priceAmount: '5100.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: null },
  { id: offerId(8), productId: seedIds.beefProduct, sellerIndex: 7, priceAmount: null, priceCurrency: null, priceUnit: null, sellerComment: 'Есть мякоть и фарш.' },
  { id: offerId(9), productId: seedIds.beefProduct, sellerIndex: 9, priceAmount: '4650.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Сегодняшний привоз.' },

  { id: offerId(10), productId: demoProductIds.honey, sellerIndex: 3, priceAmount: '3200.00', priceCurrency: 'KZT', priceUnit: 'банка', sellerComment: 'Разнотравье, банка 0,7 л.' },
  { id: offerId(11), productId: demoProductIds.honey, sellerIndex: 8, priceAmount: '4500.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: null },
  { id: offerId(12), productId: demoProductIds.honey, sellerIndex: 12, priceAmount: null, priceCurrency: null, priceUnit: null, sellerComment: 'Есть несколько сортов.' },

  { id: offerId(13), productId: demoProductIds.potato, sellerIndex: 4, priceAmount: '280.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Мелкий и крупный.' },
  { id: offerId(14), productId: demoProductIds.potato, sellerIndex: 7, priceAmount: '320.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: null },
  { id: offerId(15), productId: demoProductIds.potato, sellerIndex: 11, priceAmount: '250.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Мешками дешевле.' },

  { id: offerId(16), productId: demoProductIds.kumis, sellerIndex: 5, priceAmount: '1800.00', priceCurrency: 'KZT', priceUnit: 'л', sellerComment: 'Свежий утренний кумыс.' },
  { id: offerId(17), productId: demoProductIds.kumis, sellerIndex: 12, priceAmount: '2000.00', priceCurrency: 'KZT', priceUnit: 'л', sellerComment: null },

  { id: offerId(18), productId: demoProductIds.apple, sellerIndex: 9, priceAmount: '750.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Алматинский апорт.' },
  { id: offerId(19), productId: demoProductIds.apple, sellerIndex: 11, priceAmount: '620.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: null },

  { id: offerId(20), productId: demoProductIds.cheese, sellerIndex: 6, priceAmount: '3900.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Домашний полутвёрдый сыр.' },
  { id: offerId(21), productId: demoProductIds.curd, sellerIndex: 5, priceAmount: '1700.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Творог 9%.' },
  { id: offerId(22), productId: demoProductIds.tomato, sellerIndex: 7, priceAmount: '850.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Розовые помидоры.' },
  { id: offerId(23), productId: demoProductIds.cucumber, sellerIndex: 4, priceAmount: '650.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: null },
  { id: offerId(24), productId: demoProductIds.strawberry, sellerIndex: 10, priceAmount: '2200.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Небольшая партия.' },
  { id: offerId(25), productId: demoProductIds.raspberryJam, sellerIndex: 8, priceAmount: '2500.00', priceCurrency: 'KZT', priceUnit: 'банка', sellerComment: 'Домашнее варенье, 0,5 л.' },
];

export async function seedDemoMarketplace(db: Database, now: Date = new Date()) {
  await db.transaction(async (tx) => {
    for (const product of demoProducts) {
      await tx.insert(products).values(product).onConflictDoUpdate({ target: products.id, set: product });
    }

    for (const seller of demoSellers) {
      await tx.insert(sellers).values(seller).onConflictDoUpdate({ target: sellers.id, set: seller });
    }

    for (const location of demoLocations) {
      await tx.insert(locations).values(location).onConflictDoUpdate({ target: locations.id, set: location });
    }

    for (const offer of demoOffers) {
      const row = {
        id: offer.id,
        productId: offer.productId,
        sellerId: sellerId(offer.sellerIndex),
        locationId: locationId(offer.sellerIndex),
        priceAmount: offer.priceAmount,
        priceCurrency: offer.priceCurrency,
        priceUnit: offer.priceUnit,
        sellerComment: offer.sellerComment,
        status: 'active' as const,
        lastConfirmedAt: now,
        revision: 1,
        createdAt: new Date('2026-09-15T00:00:00Z'),
        updatedAt: now,
      };
      await tx.insert(offers).values(row).onConflictDoUpdate({ target: offers.id, set: row });
    }
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const { db, pool } = createDatabase(url);
  const now = new Date();
  try {
    await seedDatabase(db, now);
    await seedDemoMarketplace(db, now);
    console.log(`Demo marketplace seed complete: ${demoProducts.length} products, ${demoSellers.length} sellers, ${demoLocations.length} locations, ${demoOffers.length} extra active offers.`);
    console.log('Try: Баранина, Говядина, Мёд, Картофель, Кумыс, Яблоки. Some sellers have contacts, some intentionally do not.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Demo marketplace seed failed.', error);
    process.exitCode = 1;
  });
}
