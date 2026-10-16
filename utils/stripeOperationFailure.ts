/** Only explicit Stripe rejections prove no money movement occurred.
 * Network errors, timeouts, 5xx and idempotency conflicts require reconciliation.
 */
export function isDefinitiveStripeFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { type?: string; statusCode?: number };
  return ['StripeInvalidRequestError', 'StripeCardError', 'StripeAuthenticationError', 'StripePermissionError'].includes(e.type || '')
    && !!e.statusCode && e.statusCode >= 400 && e.statusCode < 500 && e.statusCode !== 409;
}
export function refundIdempotencyKey(id: string) { return `wallet_refund:${id}`; }
