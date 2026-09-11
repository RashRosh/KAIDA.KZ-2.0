export interface OtpDeliveryInput {
  challengeId: string;
  phoneE164: string;
  code: string;
  expiresAt: Date;
}

export interface OtpDelivery<Receipt> {
  deliver(input: OtpDeliveryInput): Promise<Receipt>;
}

export interface TestOtpDeliveryReceipt {
  mode: 'test';
  code: string;
}

export const testOtpDelivery: OtpDelivery<TestOtpDeliveryReceipt> = {
  async deliver({ code }) {
    return { mode: 'test', code };
  },
};
