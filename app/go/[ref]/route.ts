import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, context: any) {
  return NextResponse.redirect('https://google.com', 307);
}