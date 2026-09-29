/**
 * Centralized payment validation helper
 */
export function isCardPayment(method: string): boolean {
  const cardMethods = ["CREDIT_CARD", "VISA", "MASTERCARD"];
  return cardMethods.includes(method.toUpperCase());
}
