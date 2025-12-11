// app/api/meta/ad-insights/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // get all active ads
  const { data: liveAds, error: liveAdsError } = await supabase.from('live_ads').select('*').eq('status', 'active')

  if (liveAdsError) {
    console.error('[❌ Error fetching live_ads]', liveAdsError.message)
    return NextResponse.json({ success: false, error: liveAdsError.message })
  }

  if (!liveAds || liveAds.length === 0) {
    console.log('[ℹ️ No active live ads found]')
    return NextResponse.json({ success: true, message: 'No active ads to update' })
  }

  console.log(`[📢 Found ${liveAds.length} active ads to sync from Meta]`)

  for (const ad of liveAds) {
    const { business_email, meta_ad_id } = ad
    const { data: metaConn } = await supabase.from('meta_connections').select('*').eq('business_email', business_email).single()
    if (!metaConn) continue

    const insightsRes = await fetch(
      `https://graph.facebook.com/v21.0/${meta_ad_id}/insights?fields=spend,clicks,actions&access_token=${metaConn.access_token}`
    )
    const insights = await insightsRes.json()
    console.log('[📊 Meta Insights Response]', JSON.stringify(insights, null, 2))
    const spend = parseFloat(insights.data?.[0]?.spend || 0)
    const clicks = parseInt(insights.data?.[0]?.clicks || 0)

    // update live_ads
    await supabase.from('live_ads').update({ spend, clicks }).eq('id', ad.id)

    console.log(`[💰 Updating Ad Spend] Ad ID: ${meta_ad_id}, Spend: ${spend}, Clicks: ${clicks}`)

    // trigger deduction logic
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/stripe/transfer-ad-spend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        affiliate_email: ad.affiliate_email,
        business_email: ad.business_email,
        offer_id: ad.offer_id,
        live_ad_id: ad.id,
        amount: spend,
        currency: 'AUD',
        reason: 'meta_ad_spend_sync'
      })
    })
  }

  return NextResponse.json({ success: true })
}