import { NextRequest, NextResponse } from 'next/server';
import { requireBusiness, webhookBaseUrl, BUSINESS_PAGE, errorReason } from '../../../../lib/shopify/server';
import { PENDING_COOKIE, pendingCookieOptions, takePending, COMPLETE_PATH } from '../../../../lib/shopify/pending';
import { requiredScopes, hasRequiredScopes } from '../../../../lib/shopify/security';
import { connectShop } from '../../../../lib/shopify/connect';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const destination = new URL(BUSINESS_PAGE, req.nextUrl.origin);
  try {
    const { admin, user, businessId } = await requireBusiness();
    const pending = await takePending(admin, req.cookies.get(PENDING_COOKIE)?.value, user.id, businessId);
    if (!hasRequiredScopes(pending.scopes, requiredScopes())) throw new Error('missing_scopes');
    await connectShop(admin, businessId, pending.shop_domain, pending.scopes, {
      access_token_encrypted: pending.access_token_encrypted, refresh_token_encrypted: pending.refresh_token_encrypted,
      access_token_expires_at: pending.access_token_expires_at, refresh_token_expires_at: pending.refresh_token_expires_at,
    }, webhookBaseUrl(req));
    destination.searchParams.set('shopify', 'connected');
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      return NextResponse.redirect(new URL(`/login/business?next=${encodeURIComponent(COMPLETE_PATH)}`, req.nextUrl.origin));
    }
    destination.searchParams.set('shopify_error', errorReason(error));
  }
  const response = NextResponse.redirect(destination);
  response.cookies.set(PENDING_COOKIE, '', { ...pendingCookieOptions, maxAge: 0 });
  return response;
}
