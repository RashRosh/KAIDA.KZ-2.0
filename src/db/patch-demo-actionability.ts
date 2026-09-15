import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDatabase } from './client';
import { locations, sellers } from './schema';
import { seedIds } from './seed';

const demoSellerId = (index: number) => `52000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const requiredPhonePatches = [
  { id: seedIds.seller, contactPhoneE164: '+70000000000' },
  { id: demoSellerId(1), contactPhoneE164: '+70000000001' },
  { id: demoSellerId(2), contactPhoneE164: '+70000000002' },
  { id: demoSellerId(3), contactPhoneE164: '+70000000003' },
  { id: demoSellerId(4), contactPhoneE164: '+70000000004' },
  { id: demoSellerId(5), contactPhoneE164: '+70000000005' },
  { id: demoSellerId(6), contactPhoneE164: '+70000000006' },
  { id: demoSellerId(7), contactPhoneE164: '+70000000007' },
  { id: demoSellerId(8), contactPhoneE164: '+70000000008' },
  { id: demoSellerId(9), contactPhoneE164: '+70000000009' },
  { id: demoSellerId(10), contactPhoneE164: '+70000000010' },
  { id: demoSellerId(11), contactPhoneE164: '+70000000011' },
  { id: demoSellerId(12), contactPhoneE164: '+70000000012' },
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const { db, pool } = createDatabase(url);
  try {
    await db.transaction(async (tx) => {
      for (const patch of requiredPhonePatches) {
        await tx.update(sellers)
          .set({ contactPhoneE164: patch.contactPhoneE164 })
          .where(eq(sellers.id, patch.id));
      }

      await tx.update(locations)
        .set({ latitude: 43.2631, longitude: 76.9292 })
        .where(eq(locations.id, seedIds.location));
    });

    console.log('Demo actionability patch complete: every demo seller has a phone; every demo location has coordinates. Optional WhatsApp / Telegram / Instagram values remain intentionally varied.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Demo actionability patch failed.', error);
  process.exitCode = 1;
});
