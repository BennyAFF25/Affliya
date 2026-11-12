export const ORGANIC_CAPTION_MAX_LENGTH = 500;
export const ORGANIC_CAPTION_ERROR = `Organic captions must be ${ORGANIC_CAPTION_MAX_LENGTH} characters or fewer.`;
export function isOrganicCaptionTooLong(caption: unknown): boolean {
  return typeof caption === "string" && caption.length > ORGANIC_CAPTION_MAX_LENGTH;
}
