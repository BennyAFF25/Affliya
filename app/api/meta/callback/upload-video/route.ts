// app/api/meta/callback/upload-video/route.ts
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Needs elevated RLS access
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[📥 Meta Upload Request Body]', body);

    const { adIdeaId, offerId, ...rest } = body;
    const fallback_image_url = rest.thumbnail_url;
    const image_hash = null;

    // 1. Fetch the offer from Supabase
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('business_email')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      console.error('[❌ Offer Lookup Error]', offerError?.message || 'No offer found');
      return NextResponse.json({ success: false, error: 'Offer lookup failed' }, { status: 400 });
    }

    const businessEmail = offer.business_email;
    console.log('[📇 Matched Business Email]', businessEmail);

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

    const { ad_account_id, page_id } = connection;
    console.log('[📎 Matched Meta IDs]', { ad_account_id, page_id });

    // Map user-friendly objective to Meta-compatible enum
    const objectiveMap: Record<string, string> = {
      "Traffic": "OUTCOME_TRAFFIC",
      "Leads": "OUTCOME_LEADS",
      "Sales": "OUTCOME_SALES",
      "Engagement": "OUTCOME_ENGAGEMENT",
      "Awareness": "OUTCOME_AWARENESS",
      "Video Views": "VIDEO_VIEWS",
      "Conversions": "CONVERSIONS",
      "App Installs": "APP_INSTALLS"
    };
    const mappedObjective = objectiveMap[rest.objective] || 'OUTCOME_TRAFFIC';

    // 3. Build payload for Meta API
    const payload = {
      ...rest,
      adIdeaId,
      offerId,
      metaAdAccountId: ad_account_id,
      metaPageId: page_id,
    };

    console.log('[📤 Sending Final Payload to Meta API]', payload);

    // 4. Fetch access token
    const { access_token } = connection;

    if (!access_token) {
      console.error('[❌ Missing Access Token]');
      return NextResponse.json({ success: false, error: 'No Meta access token found' }, { status: 400 });
    }

    // 5. Create campaign (mock structure, adjust for actual app needs)
    const cleanAdAccountId = ad_account_id.startsWith('act_') ? ad_account_id : `act_${ad_account_id}`;
    console.log('[🛠 Clean Ad Account ID]', cleanAdAccountId);
    const createCampaignRes = await fetch(`https://graph.facebook.com/v19.0/${cleanAdAccountId}/campaigns`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: payload.campaign_name || 'Affliya Campaign',
        objective: mappedObjective,
        status: 'ACTIVE',
        special_ad_categories: [payload.special_ad_category || 'NONE']
      })
    });

    const campaignData = await createCampaignRes.json();
    if (!campaignData.id) {
      console.error('[❌ Campaign Creation Failed]', campaignData);
      return NextResponse.json({ success: false, error: 'Campaign creation failed', meta: campaignData }, { status: 400 });
    }

    // Log success and return
    console.log('[✅ Campaign Created]', campaignData);

    // Update Supabase row with the new campaign ID
    const updateRes = await supabase
      .from('ad_ideas')
      .update({ meta_campaign_id: campaignData.id })
      .eq('id', adIdeaId);

    if (updateRes.error) {
      console.error('[❌ Failed to Update Campaign ID in Supabase]', updateRes.error.message);
    } else {
      console.log('[✅ Campaign ID Updated in Supabase]', updateRes.data);

      // --- Create Ad Set ---
      const countryMap: Record<string, string> = {
        Australia: "AU",
        "United States": "US",
        Canada: "CA",
        "United Kingdom": "GB",
        Germany: "DE",
        France: "FR",
        India: "IN",
        // Add more as needed
      };
      const isoCountry = countryMap[payload.location] || "AU";

      const adSetRes = await fetch(`https://graph.facebook.com/v19.0/${cleanAdAccountId}/adsets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: `Ad Set – ${campaignData.id}`,
          campaign_id: campaignData.id,
          daily_budget: String(payload.daily_budget || 1000),
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'REACH',
          bid_amount: '100', // Added to satisfy Meta API requirement
          start_time: new Date(Date.now() + 60000).toISOString(),
          end_time: new Date(Date.now() + 7 * 86400000).toISOString(),
          targeting: JSON.stringify({
            geo_locations: { countries: [isoCountry] },
            age_min: parseInt(payload.age_range?.[0] || '18'),
            genders: payload.gender === 'Male' ? [1] : payload.gender === 'Female' ? [2] : [1, 2],
            interests: payload.interests ? [{ id: '6003139266461', name: payload.interests }] : [],
          }),
          pacing_type: JSON.stringify(['standard']),
          status: 'ACTIVE',
        }),
      }).then((res) => res.json());

      if (!adSetRes.id) {
        console.error('[❌ Ad Set Creation Failed]', adSetRes);
      } else {
        console.log('[✅ Ad Set Created]', adSetRes);

        // --- Upload Video to Meta ---
        const videoUploadRes = await fetch(`https://graph.facebook.com/v19.0/${cleanAdAccountId}/advideos`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`
          },
          body: new URLSearchParams({
            file_url: payload.videoUrl,
            name: payload.ad_name || `Affliya Video`,
            description: payload.caption || ''
          })
        }).then(res => res.json());

        if (!videoUploadRes.id) {
          console.error('[❌ Video Upload to Meta Failed]', videoUploadRes);
          return NextResponse.json({ success: false, error: 'Video upload failed', meta: videoUploadRes }, { status: 400 });
        }

        const video_id = videoUploadRes.id;
        console.log('[✅ Video Uploaded to Meta]', video_id);

        // --- Upload Thumbnail to Meta to Get Image Hash ---
        // Skipping thumbnail upload due to dev mode restrictions

        // --- Create Ad Creative ---
        const creativeRes = await fetch(`https://graph.facebook.com/v19.0/${cleanAdAccountId}/adcreatives`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: payload.ad_name || `Creative – ${campaignData.id}`,
            object_story_spec: {
              page_id: page_id,
              video_data: {
                video_id,
                title: payload.headline || `Your Headline`,
                message: payload.caption || '',
                call_to_action: {
                  type: payload.call_to_action || 'LEARN_MORE',
                  value: {
                    link: payload.display_link || 'https://affliya.com'
                  }
                },
                ...(image_hash ? { image_hash } : fallback_image_url ? { image_url: fallback_image_url } : {})
              }
            }
          })
        }).then(res => res.json());

        if (!creativeRes.id) {
          console.error('[❌ Ad Creative Creation Failed]', creativeRes);
        } else {
          console.log('[✅ Ad Creative Created]', creativeRes);

          // --- Create Ad ---
          const adRes = await fetch(`https://graph.facebook.com/v19.0/${cleanAdAccountId}/ads`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: `Ad – ${campaignData.id}`,
              adset_id: adSetRes.id,
              creative: { creative_id: creativeRes.id },
              status: 'ACTIVE',
              start_time: new Date(Date.now() + 60000).toISOString()
            })
          }).then(res => res.json());

          if (!adRes.id) {
            console.error('[❌ Ad Creation Failed]', adRes);
          } else {
            console.log('[✅ Ad Created]', adRes);
            // Insert a row into live_ads with campaign metadata
            await supabase.from('live_ads').insert({
              ad_idea_id: adIdeaId,
              meta_ad_id: adRes.id,
              campaign_id: campaignData.id,
              ad_set_id: adSetRes.id,
              creative_id: creativeRes.id,
              affiliate_email: payload.affiliate_email,
              business_email: businessEmail,
              status: 'active',
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, campaignId: campaignData.id });

  } catch (err: any) {
    console.error('[❌ Upload API Error]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}