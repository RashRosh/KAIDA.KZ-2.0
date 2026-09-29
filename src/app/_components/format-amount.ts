// Keep the decimal as a string throughout formatting, including large amounts: «12 345,5».
export function formatAmount(amount: string): string {
  const [whole, fraction] = amount.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (decimals ? `,${decimals}` : '');
}
