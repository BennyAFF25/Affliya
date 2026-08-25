import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import {
  cleanNullableText,
  CONTENT_LIBRARY_BUCKET,
  inferMediaType,
  parseBoolean,
  slugifyFilenamePart,
  validateCreativeFile,
  validateThumbnailFile,
} from "@/../utils/contentLibrary";

async function getBusinessUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return { error: "Unauthorized", status: 401, user: null };
  return { user, status: 200, error: null };
}

async function uploadFile(file: File, businessEmail: string, kind: "asset" | "thumbnail") {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${slugifyFilenamePart(file.name.replace(/\.[^.]+$/, ""))}.${ext}`;
  const filePath = `${slugifyFilenamePart(businessEmail)}/${kind === "thumbnail" ? "thumbnails" : "assets"}/${fileName}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage.from(CONTENT_LIBRARY_BUCKET).upload(filePath, Buffer.from(arrayBuffer), {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw new Error(error.message || `Failed to upload ${kind}`);
  }

  const { data } = supabaseAdmin.storage.from(CONTENT_LIBRARY_BUCKET).getPublicUrl(filePath);
  return { filePath, publicUrl: data.publicUrl };
}

async function logEvent(params: {
  eventType: string;
  actorEmail: string;
  businessCreativeId?: string | null;
  offerId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await (supabaseAdmin as any).from("product_events").insert({
    event_type: params.eventType,
    actor_email: params.actorEmail,
    actor_role: "business",
    offer_id: params.offerId || null,
    business_creative_id: params.businessCreativeId || null,
    meta: params.meta || {},
  });
}

export async function GET() {
  try {
    const auth = await getBusinessUser();
    if (!auth.user) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const businessEmail = auth.user.email as string;

    const [{ data: assets, error: assetError }, { data: offers, error: offerError }] = await Promise.all([
      (supabaseAdmin as any)
        .from("business_creatives")
        .select("*")
        .eq("business_email", businessEmail)
        .order("updated_at", { ascending: false }),
      (supabaseAdmin as any)
        .from("offers")
        .select("id, title")
        .eq("business_email", businessEmail),
    ]);

    if (assetError) {
      throw new Error(assetError.message || "Failed to load content library assets");
    }
    if (offerError) {
      throw new Error(offerError.message || "Failed to load offers");
    }

    const assetIds = (assets || []).map((row: any) => row.id).filter(Boolean);
    const [adIdeasResult, organicPostsResult] = assetIds.length
      ? await Promise.all([
          (supabaseAdmin as any)
            .from("ad_ideas")
            .select("id, business_creative_id")
            .in("business_creative_id", assetIds),
          (supabaseAdmin as any)
            .from("organic_posts")
            .select("id, business_creative_id")
            .in("business_creative_id", assetIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (adIdeasResult.error) throw new Error(adIdeasResult.error.message || "Failed to load ad idea usage");
    if (organicPostsResult.error) throw new Error(organicPostsResult.error.message || "Failed to load organic usage");

    const usageMap = new Map<string, number>();
    for (const row of [...(adIdeasResult.data || []), ...(organicPostsResult.data || [])] as any[]) {
      const id = String(row.business_creative_id || "");
      if (!id) continue;
      usageMap.set(id, (usageMap.get(id) || 0) + 1);
    }

    const offerMap = new Map<string, string>();
    for (const offer of (offers || []) as any[]) {
      offerMap.set(String(offer.id), String(offer.title || ""));
    }

    const enriched = (assets || []).map((asset: any) => ({
      ...asset,
      usage_count: usageMap.get(String(asset.id)) || 0,
      offer_title: asset.offer_id ? offerMap.get(String(asset.offer_id)) || null : null,
    }));

    return NextResponse.json({ ok: true, assets: enriched, offers: offers || [] });
  } catch (error: any) {
    console.error("[business/content-library][GET] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getBusinessUser();
    if (!auth.user) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const businessEmail = auth.user.email as string;
    const formData = await req.formData();
    const file = formData.get("file");
    const thumbnail = formData.get("thumbnail");
    const providedMediaUrl = cleanNullableText(formData.get("media_url"));
    const providedFilePath = cleanNullableText(formData.get("file_path"));
    const providedMediaType = cleanNullableText(formData.get("media_type"));
    const providedSourceFilename = cleanNullableText(formData.get("source_filename"));

    let mediaType: "image" | "video" | null = null;
    let assetUpload: { filePath: string; publicUrl: string } | null = null;

    if (file instanceof File) {
      const fileValidationError = validateCreativeFile(file);
      if (fileValidationError) {
        return NextResponse.json({ ok: false, error: fileValidationError }, { status: 400 });
      }

      mediaType = inferMediaType(file);
      if (!mediaType) {
        return NextResponse.json({ ok: false, error: "Unsupported media type." }, { status: 400 });
      }
    } else if (providedMediaUrl && providedFilePath && (providedMediaType === "image" || providedMediaType === "video")) {
      mediaType = providedMediaType;
      assetUpload = { filePath: providedFilePath, publicUrl: providedMediaUrl };
    } else {
      return NextResponse.json({ ok: false, error: "A creative file is required." }, { status: 400 });
    }

    const offerId = cleanNullableText(formData.get("offer_id"));
    if (offerId) {
      const { data: offer, error: offerError } = await (supabaseAdmin as any)
        .from("offers")
        .select("id")
        .eq("id", offerId)
        .eq("business_email", businessEmail)
        .maybeSingle();

      if (offerError || !offer) {
        return NextResponse.json({ ok: false, error: "You can only attach content to your own offers." }, { status: 403 });
      }
    }

    const allowPaid = parseBoolean(formData.get("allow_paid"), false);
    const allowOrganic = parseBoolean(formData.get("allow_organic"), true);
    const paidPreapproved = parseBoolean(formData.get("paid_preapproved"), false);
    const organicPreapproved = parseBoolean(formData.get("organic_preapproved"), false);
    const isActive = parseBoolean(formData.get("is_active"), true);

    if (!allowPaid && !allowOrganic) {
      return NextResponse.json({ ok: false, error: "Choose at least one usage mode." }, { status: 400 });
    }

    let thumbnailUpload: { filePath: string; publicUrl: string } | null = null;
    const providedThumbnailUrl = cleanNullableText(formData.get("thumbnail_url"));
    const providedThumbnailPath = cleanNullableText(formData.get("thumbnail_path"));
    if (thumbnail instanceof File && thumbnail.size > 0) {
      const thumbError = validateThumbnailFile(thumbnail);
      if (thumbError) {
        return NextResponse.json({ ok: false, error: thumbError }, { status: 400 });
      }
      thumbnailUpload = await uploadFile(thumbnail, businessEmail, "thumbnail");
    } else if (providedThumbnailUrl && providedThumbnailPath) {
      thumbnailUpload = { filePath: providedThumbnailPath, publicUrl: providedThumbnailUrl };
    }

    if (mediaType === "video" && allowPaid && !thumbnailUpload) {
      return NextResponse.json({ ok: false, error: "Paid video assets need a thumbnail for Meta launch." }, { status: 400 });
    }

    if (!assetUpload && file instanceof File) {
      assetUpload = await uploadFile(file, businessEmail, "asset");
    }

    const insertPayload = {
      id: crypto.randomUUID(),
      business_email: businessEmail,
      offer_id: offerId,
      title: cleanNullableText(formData.get("title")) || file.name,
      caption: cleanNullableText(formData.get("caption")),
      media_url: assetUpload!.publicUrl,
      media_type: mediaType,
      thumbnail_url: thumbnailUpload?.publicUrl || null,
      file_path: assetUpload!.filePath,
      thumbnail_path: thumbnailUpload?.filePath || null,
      source_filename: providedSourceFilename || (file instanceof File ? file.name : null),
      type: cleanNullableText(formData.get("type")) || "suggested",
      audience: cleanNullableText(formData.get("audience")),
      location: cleanNullableText(formData.get("location")),
      allow_organic: allowOrganic,
      allow_paid: allowPaid,
      organic_preapproved: organicPreapproved,
      paid_preapproved: paidPreapproved,
      is_active: isActive,
      archived_at: isActive ? null : new Date().toISOString(),
    };

    const { data, error } = await (supabaseAdmin as any)
      .from("business_creatives")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to save content library asset");
    }

    await logEvent({
      eventType: "content_library_asset_uploaded",
      actorEmail: businessEmail,
      businessCreativeId: data.id,
      offerId,
      meta: { mediaType, allowOrganic, allowPaid },
    });

    return NextResponse.json({ ok: true, asset: data });
  } catch (error: any) {
    console.error("[business/content-library][POST] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}

