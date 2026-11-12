import { isUuid } from '../../utils/tracking/campaignIdentity';
type RecordValue = Record<string, unknown>;
function object(v: unknown): RecordValue { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('invalid_payload'); return v as RecordValue; }
function id(v: unknown): string { if (!/^[1-9]\d{0,19}$/.test(String(v))) throw new Error('invalid_payload'); return String(v); }
function money(v: unknown): number { if ((typeof v !== 'string' && typeof v !== 'number') || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1e10) throw new Error('invalid_payload'); return Number(v); }
function date(v: unknown): number | null { if (v == null || v === '') return null; if (typeof v !== 'string' || v.length > 40) throw new Error('invalid_payload'); const n = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v.replace(' ', 'T')}Z`); if (!Number.isFinite(n)) throw new Error('invalid_payload'); return n; }
export type Attribution = { nm_aff: string; nm_camp: string; nm_src: string | null };
export function extractAttribution(meta: unknown, orderTime: number): Attribution | null {
  if (!Array.isArray(meta)) return null;
  const get = (key: string) => { const row = meta.find(v => v && typeof v === 'object' && v.key === `_wc_order_attribution_${key}`); return typeof row?.value === 'string' ? row.value : null; };
  const start = date(get('session_start_time'));
  if (start != null && (orderTime - start > 7 * 86400000 || start > orderTime + 300000)) return null;
  let aff: string | null = null, camp: string | null = null, src: string | null = null;
  try { const p = new URL(get('session_entry') || '').searchParams; aff = p.get('nm_aff'); camp = p.get('nm_camp'); src = p.get('nm_src'); } catch { /* Try core UTM fields. */ }
  if ((!aff || !camp) && get('utm_source') === 'nettmark') { aff = get('utm_content'); camp = get('utm_campaign'); src = 'nettmark'; }
  if (!isUuid(aff) || !camp || (!isUuid(camp) && !/^\d{1,30}$/.test(camp))) return null;
  return { nm_aff: aff!, nm_camp: camp, nm_src: src && /^[a-zA-Z0-9_-]{1,64}$/.test(src) ? src : null };
}
// The incoming object is never spread, logged or persisted. Landing URL/meta are discarded here.
export function reduceOrder(input: unknown) {
  const v = object(input), order_id = id(v.id);
  const status = typeof v.status === 'string' && /^[a-z-]{1,24}$/.test(v.status) ? v.status : 'unknown';
  if (!['processing', 'completed'].includes(status)) return { order_id, status, total_value: 0, currency: '', line_items: [], attribution: null };
  const time = date(v.date_paid_gmt) ?? date(v.date_created_gmt);
  if (time == null || !/^[A-Z]{3}$/.test(String(v.currency)) || !Array.isArray(v.line_items) || v.line_items.length > 1000) throw new Error('invalid_payload');
  const line_items = v.line_items.map(entry => {
    const i = object(entry); const quantity = Number(i.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100000) throw new Error('invalid_payload');
    return { product_id: id(i.product_id), variation_id: i.variation_id && Number(i.variation_id) !== 0 ? id(i.variation_id) : null, quantity, line_total: money(i.total) };
  });
  return { order_id, status, total_value: money(v.total), currency: String(v.currency), line_items, attribution: extractAttribution(v.meta_data, time) };
}
export function addWooUtms(url: URL) {
  for (const [key,value] of Object.entries({ utm_source: 'nettmark', utm_medium: 'affiliate', utm_campaign: url.searchParams.get('nm_camp') || '', utm_content: url.searchParams.get('nm_aff') || '' })) if (!url.searchParams.has(key)) url.searchParams.set(key,value);
}
export function isPing(raw: Buffer): boolean { return /^webhook_id=\d+$/.test(raw.toString('utf8')); }
