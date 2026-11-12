export const ORGANIC_CAPTION_MAX_LENGTH = 500;
export const ORGANIC_CAPTION_ERROR = `Organic captions must be ${ORGANIC_CAPTION_MAX_LENGTH} characters or fewer.`;
export function isOrganicCaptionTooLong(caption: unknown): boolean {
  return typeof caption === "string" && caption.length > ORGANIC_CAPTION_MAX_LENGTH;
}

export const ORGANIC_CAPTION_TYPE_ERROR = "Caption must be text.";
/** UTF-16 units intentionally make server validation stricter than SQL char_length codepoints. */
export function organicCaptionError(caption: unknown): string | null {
  if (caption != null && typeof caption !== "string") return ORGANIC_CAPTION_TYPE_ERROR;
  return isOrganicCaptionTooLong(caption) ? ORGANIC_CAPTION_ERROR : null;
}
