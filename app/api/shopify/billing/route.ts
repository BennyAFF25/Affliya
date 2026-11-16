import { protectedCallbackUrl } from '../../../../lib/shopify/admin';
import { NextResponse } from 'next/server';
import { requireBusiness, webhookBaseUrl } from '../../../../lib/shopify/server';
import { changeShopifyPlan } from '../../../../lib/shopify/billing';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const { admin, businessId } = await requireBusiness();
    const body = await req.json();
    if (body.plan !== 'free' && body.plan !== 'growth') return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    return NextResponse.json(await changeShopifyPlan(admin, businessId, body.plan, protectedCallbackUrl(`${webhookBaseUrl(req)}/api/shopify/billing/confirm`)));
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    const status = reason === 'unauthorized' ? 401 : ['forbidden', 'shop_not_owned'].includes(reason) ? 403 : reason === 'stripe_billing_required' ? 409 : 503;
    if (reason === 'growth_unavailable_currency') return NextResponse.json({ code: reason, error: 'Growth is unavailable in your Shopify billing currency until a USD price is configured. You can still choose Free.' }, { status: 409 });
    return NextResponse.json({ error: status === 409 ? 'This business must use Stripe billing.' : 'Could not change Shopify plan. Retry, or contact support if an approval is already pending.' }, { status });
  }
}
