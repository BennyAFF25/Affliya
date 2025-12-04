/// app/api/meta/callback/upload-video/route.ts
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Needs elevated RLS access
);

async function safeParse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text };
  }
}

// Prefer-first helper to resolve from payload, then DB, then default
const prefer = <T,>(...vals: Array<T | null | undefined>) =>
  vals.find((v) => v !== undefined && v !== null) as T | undefined;

export async function POST(req: Request) {
  try {
    let liveAdRow: any = null; // will hold inserted live_ads row for response
    const body = await req.json();
    console.log('[📥 Meta Upload Request Body]', body);

    const { adIdeaId, offerId, ...rest } = body;

    // Fetch the ad_ideas row (we'll use it as fallback for dynamic fields)
    const { data: adIdea, error: adIdeaError } = await supabase
      .from('ad_ideas')
      .select('*')
      .eq('id', adIdeaId)
      .maybeSingle();

    if (adIdeaError) {
      console.warn('[⚠️ ad_ideas lookup warning]', adIdeaError.message);
    }

    const fallback_image_url = rest.thumbnail_url;
    const image_hash = null;

    // 1. Fetch the offer from Supabase (now also pulling website for display link)
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('business_email, website')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      console.error('[❌ Offer Lookup Error]', offerError?.message || 'No offer found');
      return NextResponse.json({ success: false, error: 'Offer lookup failed' }, { status: 400 });
    }

    const businessEmail = offer.business_email;
    const offerWebsite = (offer as any)?.website || null;
    console.log('[📇 Matched Business Email]', businessEmail);
    console.log('[🌐 Offer Website]', offerWebsite);

    // 2. Lookup the correct ad account ID from meta_connections
    const { data: connection, error: connectionError } = await supabase
      .from('meta_connections')
      .select('ad_account_id, page_id, access_token')
      .eq('business_email', businessEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError || !connection) {
      console.error('[❌ Meta Connection Lookup Error]', connectionError?.message || 'No connection found');
      return NextResponse.json({ success: false, error: 'Meta connection lookup failed' }, { status: 400 });
    }

    const { ad_account_id, page_id, access_token } = connection;
    console.log('[📎 Matched Meta IDs]', { ad_account_id, page_id });

    if (!access_token) {
      console.error('[❌ Missing Access Token]');
      return NextResponse.json({ success: false, error: 'No Meta access token found' }, { status: 400 });
    }

    // Map user-friendly objective to Meta-compatible enum
    const objectiveMap: Record<string, string> = {
      Traffic: 'OUTCOME_TRAFFIC',
      Leads: 'OUTCOME_LEADS',
      Sales: 'OUTCOME_SALES',
      Engagement: 'OUTCOME_ENGAGEMENT',
      Awareness: 'OUTCOME_AWARENESS',
      'Video Views': 'VIDEO_VIEWS',
      Conversions: 'CONVERSIONS',
      'App Installs': 'APP_INSTALLS',
    };
    const rawObjective = prefer(rest.objective, adIdea?.objective, 'Traffic');
    const mappedObjective = objectiveMap[rawObjective as string] || 'OUTCOME_TRAFFIC';

    // 3. Build payload for Meta API (keep misc fields)
    const payload = {
      ...rest,
      adIdeaId,
      offerId,
      metaAdAccountId: ad_account_id,
      metaPageId: page_id,
    };

    // ----- Dynamic field resolution (payload overrides DB; DB overrides defaults) -----
    const campaignName = prefer(body.campaign_name, adIdea?.campaign_name, 'Affliya Campaign');
    const adsetName = prefer(
      body.adset_name,
      adIdea?.adset_name,
      `${campaignName || 'Affliya Campaign'} – Ad Set`
    );
    const adName = prefer(
      body.ad_name,
      adIdea?.ad_name,
      `${campaignName || 'Affliya Campaign'} – Ad`
    );

    // Budget (Meta expects cents as integer strings)
    const budgetType = prefer(body.budget_type, adIdea?.budget_type, 'DAILY'); // DAILY | LIFETIME
    const budgetAmountRaw = prefer(
      body.budget_amount,
      adIdea?.budget_amount,
      (adIdea as any)?.daily_budget,
      1000
    );
    const budgetAmountStr = String(
      Math.max(100, parseInt(String(budgetAmountRaw ?? 1000), 10) || 1000)
    );

    // Timing
    const startTimeISO = prefer(body.start_time, adIdea?.start_time, null);
    const endTimeISO = prefer(body.end_time, adIdea?.end_time, null);

    // Creative fields
    const headline = prefer(body.headline, adIdea?.headline, '');
    const caption = prefer(body.caption, adIdea?.caption, '');
    const description = prefer(body.description, adIdea?.description, adIdea?.caption, '');
    const ctaType = prefer(
      body.call_to_action,
      (body as any).cta,
      adIdea?.call_to_action,
      (adIdea as any)?.cta,
      'LEARN_MORE'
    );

    // 🔗 LINKS: unified tracking vs display logic
    // 1) Canonical tracking link = Nettmark /go/... (we trust the DB column first)
    const trackingLink =
      (adIdea as any)?.tracking_link ||
      (body as any)?.tracking_link ||
      null;

    // 2) Public-facing display link = brand website, fallback to tracking if needed
    const displayLink =
      offerWebsite ||
      (body as any)?.display_link ||
      trackingLink ||
      null;

    // 3) Destination link (Meta click-through) = tracking first, then website, then display, then safe fallback
    const destinationLink =
      trackingLink ||
      offerWebsite ||
      displayLink ||
      'https://nettmark.com';

    // Media
    const videoUrl = prefer(
      (body as any).videoUrl,
      (body as any).file_url,
      adIdea?.file_url,
      rest.file_url
    );
    const thumbnailUrl = prefer(
      (body as any).thumbnail_url,
      adIdea?.thumbnail_url,
      null
    );

    console.log('[Dynamic fields]', {
      campaignName,
      adsetName,
      adName,
      mappedObjective,
      budgetType,
      budgetAmountStr,
      startTimeISO,
      endTimeISO,
      ctaType,
      trackingLink,
      displayLink,
      destinationLink,
      videoUrl,
    });

    console.log('[📤 Sending Final Payload to Meta API]', payload);

    // 5. Create campaign
    const cleanAdAccountId = ad_account_id.startsWith('act_')
      ? ad_account_id
      : `act_${ad_account_id}`;
    console.log('[🛠 Clean Ad Account ID]', cleanAdAccountId);

    const createCampaignRes = await fetch(
      `https://graph.facebook.com/v19.0/${cleanAdAccountId}/campaigns`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignName || 'Affliya Campaign',
          objective: mappedObjective,
          status: 'ACTIVE',
          special_ad_categories: [payload.special_ad_category || 'NONE'],
        }),
      }
    );
    console.log('[HTTP] campaign', createCampaignRes.status);
    const campaignData = await safeParse(createCampaignRes);
    if (!campaignData?.id) {
      console.error('[❌ Campaign Creation Failed]', campaignData);
      return NextResponse.json(
        { success: false, error: 'Campaign creation failed', meta: campaignData },
        { status: 400 }
      );
    }

    console.log('[✅ Campaign Created]', campaignData);

    // Update ad_ideas with the new Meta campaign ID
    const updateRes = await supabase
      .from('ad_ideas')
      .update({ meta_campaign_id: campaignData.id })
      .eq('id', adIdeaId);

    if (updateRes.error) {
      console.error('[❌ Failed to Update Campaign ID in Supabase]', updateRes.error.message);
    } else {
      console.log('[✅ Campaign ID Updated in Supabase]', updateRes.data);
    }

    // --- Build Ad Set targeting ---
    const countryMap: Record<string, string> = {
      Australia: 'AU',
      'United States': 'US',
      Canada: 'CA',
      'United Kingdom': 'GB',
      Germany: 'DE',
      France: 'FR',
      India: 'IN',
    };
    const countries = (() => {
      const src = (
        payload.location ??
        (adIdea as any)?.location ??
        'AU'
      ).toString();
      return src
        .split(/[\s,]+/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) =>
          s.length === 2 ? s.toUpperCase() : countryMap[s] || s.toUpperCase()
        );
    })();

    const rawPlacements: string[] = Array.isArray((payload as any).manual_placements)
      ? (payload as any).manual_placements
      : [];
    const mapFB: Record<string, string> = {
      facebook_feed: 'feed',
      facebook_stories: 'story',
      facebook_reels: 'reels',
    };
    const mapIG: Record<string, string> = {
      instagram_feed: 'stream',
      instagram_stories: 'story',
      instagram_reels: 'reels',
    };
    const facebook_positions = rawPlacements
      .filter((p) => p in mapFB)
      .map((p) => mapFB[p]);
    const instagram_positions = rawPlacements
      .filter((p) => p in mapIG)
      .map((p) => mapIG[p]);
    const publisher_platforms: string[] = [];
    if (facebook_positions.length) publisher_platforms.push('facebook');
    if (instagram_positions.length) publisher_platforms.push('instagram');

    let flexible_spec: any = undefined;
    const rawInterests = (payload as any).interests;
    try {
      const arr = Array.isArray(rawInterests)
        ? rawInterests
        : typeof rawInterests === 'string'
        ? JSON.parse(rawInterests)
        : [];
      const ids = (arr || [])
        .map((i: any) =>
          typeof i === 'object' && i?.id
            ? String(i.id)
            : /^\d+$/.test(String(i))
            ? String(i)
            : null
        )
        .filter(Boolean)
        .map((id: string) => ({ id }));
      if (ids.length) flexible_spec = [{ interests: ids }];
    } catch {
      // ignore interests parse error
    }

    const adsetParams: Record<string, string> = {
      name: adsetName || `Ad Set – ${campaignData.id}`,
      campaign_id: campaignData.id,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      bid_amount: '100',
      targeting: JSON.stringify({
        geo_locations: { countries },
        age_min: parseInt(
          (payload as any).age_range?.[0] ||
            (adIdea as any)?.age_range?.[0] ||
            '18',
          10
        ),
        age_max: parseInt(
          (payload as any).age_range?.[1] ||
            (adIdea as any)?.age_range?.[1] ||
            '65',
          10
        ),
        genders:
          (payload as any).gender === 'Male'
            ? [1]
            : (payload as any).gender === 'Female'
            ? [2]
            : (adIdea as any)?.gender === 'Male'
            ? [1]
            : (adIdea as any)?.gender === 'Female'
            ? [2]
            : [1, 2],
        ...(publisher_platforms.length ? { publisher_platforms } : {}),
        ...(facebook_positions.length ? { facebook_positions } : {}),
        ...(instagram_positions.length ? { instagram_positions } : {}),
        ...(flexible_spec ? { flexible_spec } : {}),
      }),
      pacing_type: JSON.stringify(['standard']),
      status: 'ACTIVE',
    };

    if (budgetType === 'LIFETIME') {
      adsetParams.lifetime_budget = budgetAmountStr;
      adsetParams.start_time = startTimeISO || new Date(Date.now() + 60000).toISOString();
      adsetParams.end_time =
        endTimeISO || new Date(Date.now() + 7 * 86400000).toISOString();
    } else {
      adsetParams.daily_budget = budgetAmountStr;
      adsetParams.start_time = new Date(Date.now() + 60000).toISOString();
      adsetParams.end_time = new Date(Date.now() + 7 * 86400000).toISOString();
    }

    const adSetRes = await fetch(
      `https://graph.facebook.com/v19.0/${cleanAdAccountId}/adsets`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(adsetParams),
      }
    ).then((res) => safeParse(res));
    console.log('[HTTP] adset', adSetRes?.id ? 200 : 400);

    if (!adSetRes?.id) {
      console.error('[❌ Ad Set Creation Failed]', adSetRes);
    } else {
      console.log('[✅ Ad Set Created]', adSetRes);

      // --- Upload Video to Meta ---
      const videoUploadRes = await fetch(
        `https://graph.facebook.com/v19.0/${cleanAdAccountId}/advideos`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
          body: new URLSearchParams({
            file_url: videoUrl,
            name: adName || 'Affliya Video',
            description: caption || '',
          }),
        }
      ).then((res) => safeParse(res));
      console.log('[HTTP] video', videoUploadRes?.id ? 200 : 400);

      if (!videoUploadRes?.id) {
        console.error('[❌ Video Upload to Meta Failed]', videoUploadRes);
        return NextResponse.json(
          { success: false, error: 'Video upload failed', meta: videoUploadRes },
          { status: 400 }
        );
      }

      const video_id = videoUploadRes.id;
      console.log('[✅ Video Uploaded to Meta]', video_id);

      // --- Create Ad Creative ---
      const creativeRes = await fetch(
        `https://graph.facebook.com/v19.0/${cleanAdAccountId}/adcreatives`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: adName || `Creative – ${campaignData.id}`,
            object_story_spec: {
              page_id,
              video_data: {
                video_id,
                title: headline || undefined,
                message: caption || '',
                link_description: description || undefined,
                call_to_action: {
                  type: ctaType || 'LEARN_MORE',
                  value: {
                    // Backend click destination = Nettmark tracking link when available
                    link: destinationLink,
                  },
                },
                ...(image_hash
                  ? { image_hash }
                  : fallback_image_url || thumbnailUrl
                  ? { image_url: fallback_image_url || thumbnailUrl }
                  : {}),
              },
            },
          }),
        }
      ).then((res) => safeParse(res));
      console.log('[HTTP] creative', creativeRes?.id ? 200 : 400);

      if (!creativeRes?.id) {
        console.error('[❌ Ad Creative Creation Failed]', creativeRes);
      } else {
        console.log('[✅ Ad Creative Created]', creativeRes);

        // --- Create Ad ---
        const adRes = await fetch(
          `https://graph.facebook.com/v19.0/${cleanAdAccountId}/ads`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: adName || `Ad – ${campaignData.id}`,
              adset_id: adSetRes.id,
              creative: { creative_id: creativeRes.id },
              status: 'ACTIVE',
              start_time: new Date(Date.now() + 60000).toISOString(),
            }),
          }
        ).then((res) => safeParse(res));
        console.log('[HTTP] ad', adRes?.id ? 200 : 400);

        if (!adRes?.id) {
          console.error('[❌ Ad Creation Failed]', adRes);
        } else {
          console.log('[✅ Ad Created]', adRes);

          // Prepare payload for live_ads insert (matches live_ads schema)
          const liveAdsPayload = {
            ad_idea_id: adIdeaId,
            meta_ad_id: adRes.id,
            campaign_id: campaignData.id,
            ad_set_id: adSetRes.id,
            creative_id: creativeRes.id,
            affiliate_email:
              (payload as any)?.affiliate_email ??
              (adIdea as any)?.affiliate_email ??
              null,
            business_email: businessEmail,
            status: 'active',
            spend: 0,
            clicks: 0,
            conversions: 0,
            // canonical tracking link we want tied to this live ad
            tracking_link: trackingLink || destinationLink || null,
            campaign_type: 'paid_meta',
            caption: caption || '',
            created_from: 'meta_api',
          };

          console.log('[live_ads INSERT PAYLOAD]', liveAdsPayload);

          const { data: insertedLiveAdRow, error: liveAdErr } = await supabase
            .from('live_ads')
            .insert(liveAdsPayload)
            .select('id')
            .single();

          if (liveAdErr) {
            console.error('[❌ live_ads insert error]', liveAdErr);
          } else {
            liveAdRow = insertedLiveAdRow;
            console.log('[✅ live_ads insert success]', insertedLiveAdRow);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaignId: campaignData.id,
      liveAdId: liveAdRow ? liveAdRow.id : null,
    });
  } catch (err: any) {
    console.error('[❌ Upload API Error]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}