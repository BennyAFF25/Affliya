/** Paid proposal copy contract. Organic submissions use a separate flow. */
export function validateAdCopy(input: { headline?: unknown; caption?: unknown }) {
  return {
    headline: typeof input.headline === "string" && input.headline.trim() ? null : "Enter a headline for your ad.",
    caption: typeof input.caption === "string" && input.caption.trim() ? null : "Enter a caption for your ad.",
  };
}
