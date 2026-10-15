/** Recording evidence never enables a currency or changes a money decision. */
export type CurrencySource = 'verified' | 'inferred' | 'unresolved';
export type RecordedCurrency = { currency: string | null; currency_source: CurrencySource };

export function recordCurrency(code: unknown, source: CurrencySource): RecordedCurrency {
  const currency = typeof code === 'string' ? code.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(currency)
    ? { currency, currency_source: source }
    : { currency: null, currency_source: 'unresolved' };
}

/** Use the guard's exact account/proposal/offer resolution; do not resolve again. */
export function recordCampaignCurrency(resolved: { metaAccountCurrency: string; campaignCurrency: string }): RecordedCurrency {
  return resolved.metaAccountCurrency
    ? recordCurrency(resolved.metaAccountCurrency, 'verified')
    : recordCurrency(resolved.campaignCurrency, 'inferred');
}

function metadataRejected(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string };
  // These are explicit rejected statements, never an ambiguous transport failure.
  return ['42703', 'PGRST204', '23514', '42501', '22P02'].includes(e.code || '')
    && /currency/i.test(`${e.message || ''} ${e.details || ''}`);
}

/** Keep the existing query/return shape. Retry only a rejected metadata statement,
 * with the exact original money payload. Never retry a lost network response.
 */
export async function withRecordedCurrency<T extends { error?: unknown }>(
  fields: RecordedCurrency,
  write: (fields: Partial<RecordedCurrency>) => PromiseLike<T>,
): Promise<T> {
  try {
    const result = await write(fields);
    if (!metadataRejected(result.error)) return result;
  } catch (error) {
    if (!metadataRejected(error)) throw error;
  }
  console.warn('[currency-recording] metadata rejected; continuing original money write');
  return await write({});
}

/** Only a new row ID from this operation is eligible. Never label historical rows
 * on idempotent replay, and never overwrite a previously recorded currency.
 */
export async function recordNewRowCurrency(
  supabase: { from: (table: string) => {
    update: (fields: RecordedCurrency) => {
      eq: (column: string, value: string) => {
        is: (column: string, value: null) => PromiseLike<{ error?: unknown }>;
      };
    };
  } },
  table: string,
  id: unknown,
  fields: RecordedCurrency,
): Promise<void> {
  if (typeof id !== 'string' || !id) return;
  try {
    const result = await supabase.from(table).update(fields).eq('id', id).is('currency', null);
    if (result.error) throw result.error;
  } catch {
    // No provider objects, credentials, or private account data in this log.
    console.warn('[currency-recording] follow-up failed', { table });
  }
}
