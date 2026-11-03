import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CONNECT_META_PATH, CONNECT_META_SEARCH_HEADER } from './utils/meta/connectMetaGate';

export function middleware(req: NextRequest) {
  const needsPlanChoice = req.cookies.get('nettmark_business_plan_choice_v2')?.value === 'required';
  const isBusinessDashboard = req.nextUrl.pathname === '/business/my-business';

  if (needsPlanChoice && isBusinessDashboard) {
    const url = req.nextUrl.clone();
    url.pathname = '/business/choose-plan';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname === CONNECT_META_PATH) {
    // Server layouts can't read the query string; forward it so the Growth
    // gate can keep ?meta_error= etc. in its returnTo.
    const headers = new Headers(req.headers);
    headers.set(CONNECT_META_SEARCH_HEADER, req.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/business/my-business', '/business/my-business/connect-meta'],
};
