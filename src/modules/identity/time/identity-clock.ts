export type IdentityClock = () => Date;

export const systemIdentityClock: IdentityClock = () => new Date();
