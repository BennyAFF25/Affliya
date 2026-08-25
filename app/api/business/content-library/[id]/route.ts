import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import {
  cleanNullableText,
  CONTENT_LIBRARY_BUCKET,
  inferMediaType,
  parseBoolean,
  parseStoragePathFromPublicUrl,
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

async function getOwnedAsset(id: string, businessEmail: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("business_creatives")
    .select("*")
    .eq("id", id)
    .eq("business_email", businessEmail)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to load asset");
  return data;
}

async function getUsageCount(id: string) {
  const [adIdeas, organicPosts] = await Promise.all([
    (supabaseAdmin as any).from("ad_ideas").select("id", { count: "exact", head: true }).eq("business_creative_id", id),
    (supabaseAdmin as any).from("organic_posts").select("id", { count: "exact", head: true }).eq("business_creative_id", id),
  ]);

  if (adIdeas.error) throw new Error(adIdeas.error.message || "Failed to check ad usage");
  if (organicPosts.error) throw new Error(organicPosts.error.message || "Failed to check organic usage");
  return Number(adIdeas.count || 0) + Number(organicPosts.count || 0);
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

  if (error) throw new Error(error.message || `Failed to upload ${kind}`);
  const { data } = supabaseAdmin.storage.from(CONTENT_LIBRARY_BUCKET).getPublicUrl(filePath);
  return { filePath, publicUrl: data.publicUrl };
}

async function removeStoragePaths(paths: Array<string | null | undefined>) {
  const filtered = paths.filter((path): path is string => !!path);
  if (!filtered.length) return;
  const { error } = await supabaseAdmin.storage.from(CONTENT_LIBRARY_BUCKET).remove(filtered);
  if (error) console.warn("[content-library] storage remove warn", error);
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

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await getBusinessUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const businessEmail = auth.user.email as string;
    const existing = await getOwnedAsset(id, businessEmail);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Asset not found." }, { status: 404 });
    }

    const usageCount = await getUsageCount(id);
    const formData = await req.formData();
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

    const allowPaid = parseBoolean(formData.get("allow_paid"), Boolean(existing.allow_paid));
    const allowOrganic = parseBoolean(formData.get("allow_organic"), Boolean(existing.allow_organic));
    const isActive = parseBoolean(formData.get("is_active"), Boolean(existing.is_active));
    const paidPreapproved = parseBoolean(formData.get("paid_preapproved"), Boolean(existing.paid_preapproved));
    const organicPreapproved = parseBoolean(formData.get("organic_preapproved"), Boolean(existing.organic_preapproved));

    const nextPayload: Record<string, any> = {
      offer_id: offerId,
      title: cleanNullableText(formData.get("title")) || existing.title || existing.source_filename,
      caption: cleanNullableText(formData.get("caption")),
      type: cleanNullableText(formData.get("type")) || existing.type,
      audience: cleanNullableText(formData.get("audience")),
      location: cleanNullableText(formData.get("location")),
      allow_organic: allowOrganic,
      allow_paid: allowPaid,
      organic_preapproved: organicPreapproved,
      paid_preapproved: paidPreapproved,
      is_active: isActive,
      archived_at: isActive ? null : existing.archived_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const file = formData.get("file");
    const thumbnail = formData.get("thumbnail");
    const replaceThumbnail = parseBoolean(formData.get("replace_thumbnail"), false);
    const providedMediaUrl = cleanNullableText(formData.get("media_url"));
    const providedFilePath = cleanNullableText(formData.get("file_path"));
    const providedMediaType = cleanNullableText(formData.get("media_type"));
    const providedSourceFilename = cleanNullableText(formData.get("source_filename"));
    const providedThumbnailUrl = cleanNullableText(formData.get("thumbnail_url"));
    const providedThumbnailPath = cleanNullableText(formData.get("thumbnail_path"));

    if ((file instanceof File && file.size > 0) || (providedMediaUrl && providedFilePath && providedMediaType)) {
      if (usageCount > 0) {
        return NextResponse.json({ ok: false, error: "This asset is already referenced by promotions. Archive it instead of replacing the media." }, { status: 409 });
      }

      if (file instanceof File && file.size > 0) {
        const fileError = validateCreativeFile(file);
        if (fileError) {
          return NextResponse.json({ ok: false, error: fileError }, { status: 400 });
        }
        const mediaType = inferMediaType(file);
        if (!mediaType) {
          return NextResponse.json({ ok: false, error: "Unsupported media type." }, { status: 400 });
        }
        const uploaded = await uploadFile(file, businessEmail, "asset");
        nextPayload.media_url = uploaded.publicUrl;
        nextPayload.file_path = uploaded.filePath;
        nextPayload.media_type = mediaType;
        nextPayload.source_filename = file.name;
      } else if (providedMediaUrl && providedFilePath && (providedMediaType === "image" || providedMediaType === "video")) {
        nextPayload.media_url = providedMediaUrl;
        nextPayload.file_path = providedFilePath;
        nextPayload.media_type = providedMediaType;
        nextPayload.source_filename = providedSourceFilename || existing.source_filename;
      }
    }

    if ((thumbnail instanceof File && thumbnail.size > 0) || (providedThumbnailUrl && providedThumbnailPath)) {
      if (usageCount > 0) {
        return NextResponse.json({ ok: false, error: "This asset is already referenced by promotions. Archive it instead of replacing the thumbnail." }, { status: 409 });
      }
      if (thumbnail instanceof File && thumbnail.size > 0) {
        const thumbError = validateThumbnailFile(thumbnail);
        if (thumbError) {
          return NextResponse.json({ ok: false, error: thumbError }, { status: 400 });
        }
        const uploadedThumb = await uploadFile(thumbnail, businessEmail, "thumbnail");
        nextPayload.thumbnail_url = uploadedThumb.publicUrl;
        nextPayload.thumbnail_path = uploadedThumb.filePath;
      } else if (providedThumbnailUrl && providedThumbnailPath) {
        nextPayload.thumbnail_url = providedThumbnailUrl;
        nextPayload.thumbnail_path = providedThumbnailPath;
      }
    } else if (replaceThumbnail && usageCount === 0) {
      nextPayload.thumbnail_url = null;
      nextPayload.thumbnail_path = null;
    }

    const resultingMediaType = String(nextPayload.media_type || existing.media_type || "image").toLowerCase();
    const resultingThumb = nextPayload.thumbnail_url ?? existing.thumbnail_url ?? null;
    if (resultingMediaType === "video" && allowPaid && !resultingThumb) {
      return NextResponse.json({ ok: false, error: "Paid video assets need a thumbnail for Meta launch." }, { status: 400 });
    }

    const { data, error } = await (supabaseAdmin as any)
      .from("business_creatives")
      .update(nextPayload)
      .eq("id", id)
      .eq("business_email", businessEmail)
      .select("*")
      .single();

    if (error) throw new Error(error.message || "Failed to update asset");

    if (usageCount === 0) {
      const oldAssetPath = nextPayload.file_path && nextPayload.file_path !== existing.file_path
        ? existing.file_path || parseStoragePathFromPublicUrl(existing.media_url)
        : null;
      const oldThumbPath = (nextPayload.thumbnail_path !== undefined && nextPayload.thumbnail_path !== existing.thumbnail_path)
        ? existing.thumbnail_path || parseStoragePathFromPublicUrl(existing.thumbnail_url)
        : null;
      await removeStoragePaths([oldAssetPath, oldThumbPath]);
    }

    await logEvent({
      eventType: "content_library_asset_updated",
      actorEmail: businessEmail,
      businessCreativeId: id,
      offerId: data.offer_id,
      meta: { usageCount },
    });

    return NextResponse.json({ ok: true, asset: data, usageCount });
  } catch (error: any) {
    console.error("[business/content-library][PATCH] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await getBusinessUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const businessEmail = auth.user.email as string;
    const existing = await getOwnedAsset(id, businessEmail);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Asset not found." }, { status: 404 });
    }

    const usageCount = await getUsageCount(id);
    if (usageCount > 0) {
      return NextResponse.json(
        { ok: false, error: "This asset is already referenced by promotions. Archive it instead of deleting it." },
        { status: 409 },
      );
    }

    const { error } = await (supabaseAdmin as any)
      .from("business_creatives")
      .delete()
      .eq("id", id)
      .eq("business_email", businessEmail);

    if (error) throw new Error(error.message || "Failed to delete asset");

    await removeStoragePaths([
      existing.file_path || parseStoragePathFromPublicUrl(existing.media_url),
      existing.thumbnail_path || parseStoragePathFromPublicUrl(existing.thumbnail_url),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[business/content-library][DELETE] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}

