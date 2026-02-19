import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
  // Rollback: keep middleware neutral to avoid interfering with client auth/session handling.
  return NextResponse.next();
}
