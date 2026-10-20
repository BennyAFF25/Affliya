import type { AdFormState } from '../../app/affiliate/dashboard/promote/types';
import type { ContentLibraryAsset } from '../contentLibrary';

export type SavedPromotionMedia = { url: string; thumbnail: string | null; type: 'image' | 'video' };
export type PromotionDraft = {
  version: 1; baseline?: AdFormState; form: AdFormState; step: number; source: 'upload' | 'brand';
  logo: boolean; brand: ContentLibraryAsset | null; media: SavedPromotionMedia | null; reselect: boolean;
};
/** Compare against this offer's defaults, never a hard-coded approximation. */
export function isMeaningfulDraft(draft: PromotionDraft, defaults: AdFormState): boolean {
  if (draft.media || draft.brand || draft.logo || draft.reselect) return true;
  const baseline = draft.baseline || defaults;
  return Object.keys(draft.form).some(key => {
    // Legacy drafts lack their original clock-derived schedule baseline.
    if (!draft.baseline && (key === 'start_time' || key === 'end_time')) return false;
    const field = key as keyof AdFormState;
    return JSON.stringify(draft.form[field]) !== JSON.stringify(baseline[field]);
  });
}
export function promotionDraftKey(email: string, offerId: string) {
  return `nettmark:paid-draft:${encodeURIComponent(email.trim().toLowerCase())}:${offerId}`;
}
export function readPromotionDraft(raw: string | null): PromotionDraft | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value.version !== 1 || !value.form || typeof value.form.campaign_name !== 'string' ||
      !Array.isArray(value.form.interests) || !value.form.placements || !Number.isInteger(value.step) || value.step < 1 || value.step > 4 ||
      !['brand', 'upload'].includes(value.source)) throw new Error('Saved draft could not be restored. Discard it to start again.');
  return value;
}
/** Bound the complete request, including response body parsing. Never replay writes. */
export async function promotionJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const json = await response.json();
    if (!response.ok || !json?.ok) throw new Error(json?.message || json?.error || 'Request failed. Try again.');
    return json;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request took too long. Check the status and try again. Your draft is still here.');
    throw error;
  } finally { clearTimeout(timer); }
}

/** Session verification is read-only; timing out must never replay a mutation. */
export async function withPromotionTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Checking your sign-in took too long. Try again. Your draft is still here.')), 20000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
