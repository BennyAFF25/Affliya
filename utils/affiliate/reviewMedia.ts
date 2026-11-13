/** Normalize submission media without treating video URLs as images. */
export function reviewMedia(row: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
  const source = text(row.video_url) || text(row.file_url) || text(row.image_url);
  const storedType = String(row.media_type || row.type || "").toLowerCase();
  const isVideo = !!row.video_url || storedType === "video" || storedType.startsWith("video/") || /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(source || "");
  const thumbnailUrl = text(row.thumbnail_url) || text(row.thumbnail);
  return {
    mediaType: isVideo ? "video" as const : "image" as const,
    thumbnailUrl,
    videoUrl: isVideo ? source : null,
    previewUrl: thumbnailUrl || (isVideo ? null : source),
  };
}
