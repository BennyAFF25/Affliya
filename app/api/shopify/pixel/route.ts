import { NextRequest, NextResponse } from 'next/server';
import { requireBusiness, webhookBaseUrl, errorReason, errorStatus } from '../../../../lib/shopify/server';
import { decryptToken } from '../../../../lib/shopify/security';
import { isUuid } from '../../../../utils/tracking/campaignIdentity';
import { activatePixel } from '../../../../lib/shopify/pixel';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const { admin, businessId } = await requireBusiness();
    const { id } = await req.json();
    if (!isUuid(id)) return NextResponse.json({ error: 'invalid_store' }, { status: 400 });
    const { data: store, error } = await admin.from('shopify_stores').select('shop_domain,access_token_encrypted,installed_at').eq('id', id).eq('business_id', businessId).eq('status', 'connected').maybeSingle();
    if (error) throw new Error('database');
    if (!store?.access_token_encrypted) return NextResponse.json({ error: 'store_unavailable' }, { status: 404 });
    const pixel = await activatePixel(store.shop_domain, decryptToken(store.access_token_encrypted), webhookBaseUrl(req));
    const { data: saved, error: updateError } = await admin.from('shopify_stores').update(pixel).eq('id', id).eq('business_id', businessId).eq('status', 'connected').eq('installed_at', store.installed_at).select('pixel_status,pixel_error').maybeSingle();
    if (updateError || !saved) throw new Error('database');
    return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const reason = errorReason(error);
    return NextResponse.json({ error: reason }, { status: errorStatus(reason) });
  }
}
