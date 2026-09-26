import { z } from 'zod';
import { openingHoursSchema, type OpeningHours } from '../hours/opening-hours';

// Point contacts and hours (point-contacts-hours §2). Numbers arrive as the Seller typed them and are normalized
// server-side; null clears a channel.
export const pointDetailsInputSchema = z.object({
  phone: z.string().trim().max(32).nullable(),
  whatsapp: z.string().trim().max(32).nullable(),
  openingHours: openingHoursSchema,
}).strict();

export const pointContactCodeRequestSchema = z.object({ phone: z.string().trim().min(1).max(32) }).strict();
export const pointContactCodeConfirmSchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^[0-9]{6}$/),
}).strict();

export type PointDetailsInput = z.infer<typeof pointDetailsInputSchema>;
export type PointContactView = { e164: string; verified: boolean };

export type PointDetailsView = {
  locationId: string;
  contacts: { phone: PointContactView | null; whatsapp: PointContactView | null };
  openingHours: OpeningHours;
  openingHoursNeedsReview: boolean;
};

export class InvalidPointPhoneError extends Error {
  readonly code = 'INVALID_PHONE' as const;
  constructor(readonly field: 'phone' | 'whatsapp') {
    super('Введите корректный номер телефона.');
    this.name = 'InvalidPointPhoneError';
  }
}

export class PointContactNotOnPointError extends Error {
  readonly code = 'CONTACT_NOT_ON_POINT' as const;
  constructor() {
    super('Сначала сохраните этот номер в точке.');
    this.name = 'PointContactNotOnPointError';
  }
}
