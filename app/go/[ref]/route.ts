import supabase from '@/../utils/supabase/server-client';
import { NextRequest, NextResponse } from 'next/server';


export async function GET(request: NextRequest, { params }: { params: { ref: string } }) {
  const { ref } = params;

  console.log('[🔗 Redirecting from tracking link]', { ref });

  const fallbackUrl = 'https://google.com';
  const splitIndex = ref.indexOf('___');

  if (splitIndex === -1) {
    console.warn('[❌ Invalid ref format]', ref);
    return NextResponse.redirect(fallbackUrl, 307);
  }

  const offerId = ref.substring(0, splitIndex);
  const affiliateId = ref.substring(splitIndex + 3);
  const ipAddress =
    request.headers.get('x-forwarded-for') || request.headers.get('X-Real-IP') || 'unknown';

  const { data, error } = await supabase
    .from('offers')
    .select('website')
    .eq('id', offerId)
    .single();

  console.log('[📦 Supabase Offer Response]', { data, error });

  if (error || !data?.website) {
    return NextResponse.redirect(fallbackUrl, 307);
  }

  await supabase.from('clicks').insert([
    {
      offer_id: offerId,
      affiliate_id: affiliateId,
      ref_code: ref,
      ip_address: ipAddress,
    },
  ]);

  const redirectUrl = data.website.startsWith('http') ? data.website : `https://${data.website}`;
  console.log('[✅ Redirecting to]', redirectUrl);
  return NextResponse.redirect(redirectUrl, 307);
}
