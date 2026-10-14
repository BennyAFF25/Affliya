const events = new Set(['page_view', 'create_account_start', 'business_demo_cta_click', 'landing_cta_click']);
const pages = new Set(['/', '/lp/business-demo', '/lp/partner-demo', '/create-account', '/for-businesses', '/pricing']);
export function parseSiteEventInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.eventType !== 'string' || !events.has(input.eventType) ||
      typeof input.pagePath !== 'string' || !pages.has(input.pagePath)) return null;
  if (input.audience != null && (typeof input.audience !== 'string' || input.audience.length > 100)) return null;
  if (input.meta != null && (typeof input.meta !== 'object' || Array.isArray(input.meta))) return null;
  const meta = (input.meta || {}) as Record<string, unknown>;
  if (JSON.stringify(meta).length > 16000) return null;
  return { eventType: input.eventType, pagePath: input.pagePath, audience: input.audience || null, meta };
}

// Existing databases may still enforce either of the original event checks.
// Preserve the precise event in JSON so reports can recover it without a migration.
type InsertResult = { error: { code?: string; message?: string } | null };
export async function insertSiteEvent(client: { from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<InsertResult> } }, row: Record<string, unknown>) {
  let result = await client.from('marketing_site_events').insert(row);
  if (result.error?.code === '23514' && String(result.error.message).includes('marketing_site_events_event_type_check') &&
      ['landing_cta_click', 'business_demo_cta_click'].includes(String(row.event_type))) {
    result = await client.from('marketing_site_events').insert({
      ...row, event_type: 'create_account_start',
      meta: { ...(row.meta as Record<string, unknown>), original_event_type: row.event_type },
    });
  }
  return result;
}
export function restoreSiteEventType<T extends { event_type?: string; meta?: Record<string, unknown> | null }>(row: T): T {
  const original = row.meta?.original_event_type;
  return original === 'landing_cta_click' || original === 'business_demo_cta_click'
    ? { ...row, event_type: original } : row;
}
