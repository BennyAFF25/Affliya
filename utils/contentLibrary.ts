export type ContentLibraryAsset = {
  id: string;
  business_email: string;
  offer_id: string | null;
  title: string | null;
  caption: string | null;
  media_url: string;
  media_type: "image" | "video";
  thumbnail_url: string | null;
  type: string | null;
  audience: string | null;
  location: string | null;
  allow_organic: boolean;
  allow_paid: boolean;
  organic_preapproved: boolean;
  paid_preapproved: boolean;
  is_active: boolean;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  file_path: string | null;
  thumbnail_path: string | null;
  source_filename: string | null;
  usage_count?: number;
  offer_title?: string | null;
};

export const CONTENT_LIBRARY_BUCKET = "business-creatives";
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export const MAX_THUMB_BYTES = 8 * 1024 * 1024;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const THUMB_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function parseBoolean(value: FormDataEntryValue | string | null | undefined, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function cleanNullableText(value: FormDataEntryValue | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export function inferMediaType(file: File): "image" | "video" | null {
  if (IMAGE_MIME_TYPES.includes(file.type)) return "image";
  if (VIDEO_MIME_TYPES.includes(file.type)) return "video";
  return null;
}

export function validateCreativeFile(file: File) {
  const mediaType = inferMediaType(file);
  if (!mediaType) {
    return "Content library assets must be JPG, PNG, WebP, MP4, MOV, or WebM.";
  }

  if (mediaType === "image" && file.size > MAX_IMAGE_BYTES) {
    return "Images must be under 20MB.";
  }

  if (mediaType === "video" && file.size > MAX_VIDEO_BYTES) {
    return "Videos must be under 150MB.";
  }

  return null;
}

export function validateThumbnailFile(file: File) {
  const name = (file?.name || "").toLowerCase();
  const type = file?.type || "";

  if (type === "image/svg+xml" || name.endsWith(".svg")) {
    return "Thumbnail must be PNG, JPG, or WebP. SVG is not supported.";
  }

  if (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return "Thumbnail must be PNG, JPG, or WebP. HEIC/HEIF is not supported.";
  }

  if (!THUMB_MIME_TYPES.includes(type)) {
    return "Thumbnail must be PNG, JPG, or WebP.";
  }

  if (file.size > MAX_THUMB_BYTES) {
    return "Thumbnail must be under 8MB.";
  }

  return null;
}

export function slugifyFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function parseStoragePathFromPublicUrl(url: string | null | undefined, bucket = CONTENT_LIBRARY_BUCKET) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export function getUsageScopeLabel(asset: Pick<ContentLibraryAsset, "offer_id" | "offer_title">) {
  return asset.offer_id ? asset.offer_title || "1 offer" : "All offers";
}

export function getApprovalLabel(asset: Pick<ContentLibraryAsset, "allow_organic" | "allow_paid" | "organic_preapproved" | "paid_preapproved">) {
  if (asset.allow_paid && asset.paid_preapproved) return "Paid pre-approved";
  if (asset.allow_organic && asset.organic_preapproved) return "Organic pre-approved";
  return "Final approval required";
}

