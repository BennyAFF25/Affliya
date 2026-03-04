import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    items,
  }: {
    items: Array<{
      offer_id: string;
      custom_image_url?: string | null;
      custom_price?: string | null;
      custom_description?: string | null;
      display_order?: number | null;
    }>;
  } = await request.json();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'no_items' }, { status: 400 });
  }

  try {
    const upserts = items.map((item) => ({
      affiliate_email: user.email,
      offer_id: item.offer_id,
      custom_image_url: item.custom_image_url?.trim() || null,
      custom_price: item.custom_price?.trim() || null,
      custom_description: item.custom_description?.trim() || null,
      display_order: item.display_order ?? 0,
    }));

    const { error } = await supabase
      .from('affiliate_shop_items')
      .upsert(upserts, { onConflict: 'affiliate_email,offer_id' });

    if (error) {
      console.error('[affiliate-shop] upsert error', error);
      return NextResponse.json({ error: 'upsert_failed' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[affiliate-shop] unexpected error', err);
    return NextResponse.json({ error: 'unexpected_error' }, { status: 500 });
  }
}
