import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Record<string, string> }
) {
  return NextResponse.redirect('https://google.com', 307);
}
