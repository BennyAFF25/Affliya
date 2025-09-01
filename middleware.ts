import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow everything through except explicitly block nothing
  // TEMP: bypass auth completely
  return NextResponse.next();
}