import { NextResponse } from 'next/server';
import { requireBusiness, webhookBaseUrl } from '../../../../../lib/shopify/server';
import { confirmShopifyBilling } from '../../../../../lib/shopify/billing';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const { admin, businessId } = await requireBusiness();
    // charge_id and all other query parameters are deliberately ignored.
    const subscription = await confirmShopifyBilling(admin, businessId);
    const destination = subscription?.status === 'ACTIVE' ? '/business/my-business?shopify_billing=active' : '/business/choose-plan?shopify_billing=pending';
    return NextResponse.redirect(new URL(destination, webhookBaseUrl(req)));
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    const destination = reason === 'unauthorized'
      ? `/login/business?next=${encodeURIComponent('/business/choose-plan')}`
      : '/business/choose-plan?shopify_billing=error';
    return NextResponse.redirect(new URL(destination, webhookBaseUrl(req)));
  }
}
