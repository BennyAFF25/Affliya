import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const needsPlanChoice = req.cookies.get('nettmark_business_plan_choice_v2')?.value === 'required';
  const isBusinessDashboard = req.nextUrl.pathname === '/business/my-business';

  if (needsPlanChoice && isBusinessDashboard) {
    const url = req.nextUrl.clone();
    url.pathname = '/business/choose-plan';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/business/my-business'],
};
