import { protectedCallbackUrl } from './admin';
import { validShop } from './security';

type PixelResult = { pixel_id: string | null; pixel_status: 'active' | 'error'; pixel_error: string | null; pixel_updated_at: string };
export async function pixelGraphql(shop: string, token: string, query: string, variables: Record<string, unknown> = {}, request = fetch) {
  const version = process.env.SHOPIFY_API_VERSION?.trim() || '2026-10';
  if (!validShop(shop) || !/^\d{4}-\d{2}$/.test(version)) throw new Error('configuration');
  const response = await request(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store',
  });
  if (!response.ok) throw new Error('pixel_api_failed');
  const result = await response.json();
  if (result.errors?.length) {
    // Inspect solely to classify; never persist Shopify error messages or bodies.
    if (result.errors.some((e: { message?: string }) => /no web pixel was found/i.test(e.message || ''))) throw new Error('pixel_not_found');
    if (result.errors.some((e: { message?: string }) => /pixel extension|not deployed/i.test(e.message || ''))) throw new Error('extension_not_deployed');
    throw new Error('pixel_api_failed');
  }
  return result.data;
}
export async function readPixel(shop: string, token: string, request = fetch): Promise<string | null> {
  try { return (await pixelGraphql(shop, token, 'query NettmarkPixel { webPixel { id } }', {}, request))?.webPixel?.id || null; }
  catch (error) { if (error instanceof Error && error.message === 'pixel_not_found') return null; throw error; }
}
export async function activatePixel(shop: string, token: string, base: string, request = fetch): Promise<PixelResult> {
  const pixel_updated_at = new Date().toISOString();
  let pixel_id: string | null = null;
  try {
    pixel_id = await readPixel(shop, token, request);
    const action = pixel_id ? 'webPixelUpdate' : 'webPixelCreate';
    const settings = JSON.stringify({ shopKey: shop, ingestUrl: protectedCallbackUrl(`${base}/api/shopify/pixel-events`) });
    const data = await pixelGraphql(shop, token, pixel_id
      ? 'mutation NettmarkPixel($id: ID!, $pixel: WebPixelInput!) { webPixelUpdate(id: $id, webPixel: $pixel) { webPixel { id } userErrors { code message } } }'
      : 'mutation NettmarkPixel($pixel: WebPixelInput!) { webPixelCreate(webPixel: $pixel) { webPixel { id } userErrors { code message } } }',
    pixel_id ? { id: pixel_id, pixel: { settings } } : { pixel: { settings } }, request);
    const result = data?.[action];
    if (result?.userErrors?.length) {
      const missing = result.userErrors.some((e: { code?: string; message?: string }) => /extension|not deployed|not found/i.test(`${e.code} ${e.message}`));
      throw new Error(missing ? 'extension_not_deployed' : 'pixel_activation_failed');
    }
    if (!result?.webPixel?.id) throw new Error('pixel_activation_failed');
    return { pixel_id: result.webPixel.id, pixel_status: 'active', pixel_error: null, pixel_updated_at };
  } catch (error) {
    return { pixel_id, pixel_status: 'error', pixel_error: error instanceof Error && error.message === 'extension_not_deployed' ? 'extension_not_deployed' : 'pixel_activation_failed', pixel_updated_at };
  }
}
export async function deletePixel(shop: string, token: string, request = fetch) {
  const id = await readPixel(shop, token, request);
  if (!id) return;
  const data = await pixelGraphql(shop, token, 'mutation NettmarkPixelDelete($id: ID!) { webPixelDelete(id: $id) { deletedWebPixelId userErrors { code } } }', { id }, request);
  if (data?.webPixelDelete?.userErrors?.length || !data?.webPixelDelete?.deletedWebPixelId) throw new Error('pixel_delete_failed');
}
