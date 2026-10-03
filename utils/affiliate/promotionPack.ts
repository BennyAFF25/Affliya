export type PromotionPack = {
  campaignAngle: string;
  hooks: [string, string, string];
  primaryAdCopy: string;
  headline: string;
  cta: "LEARN_MORE" | "SHOP_NOW" | "SIGN_UP";
  organicCaption: string;
  explanation: string;
};

const bounds = {
  campaignAngle: 300, primaryAdCopy: 2000, headline: 120, organicCaption: 2000, explanation: 600,
} as const;

export const promotionPackSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...Object.fromEntries(Object.entries(bounds).map(([key, maxLength]) =>
      [key, { type: "string", minLength: 1, maxLength }])),
    hooks: { type: "array", items: { type: "string", minLength: 1, maxLength: 180 }, minItems: 3, maxItems: 3 },
    cta: { type: "string", enum: ["LEARN_MORE", "SHOP_NOW", "SIGN_UP"] },
  },
  required: ["campaignAngle", "hooks", "primaryAdCopy", "headline", "cta", "organicCaption", "explanation"],
};

export function validatePromotionPack(value: unknown): PromotionPack {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid promotion pack");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== [...promotionPackSchema.required].sort().join(",")) throw new Error("Unexpected pack fields");
  for (const [key, limit] of Object.entries(bounds)) {
    if (typeof row[key] !== "string" || !row[key].trim() || row[key].length > limit) throw new Error("Invalid pack text");
  }
  if (!Array.isArray(row.hooks) || row.hooks.length !== 3 ||
    row.hooks.some(hook => typeof hook !== "string" || !hook.trim() || hook.length > 180)) throw new Error("Invalid hooks");
  if (!["LEARN_MORE", "SHOP_NOW", "SIGN_UP"].includes(String(row.cta))) throw new Error("Invalid CTA");
  return row as PromotionPack;
}

export function cleanContextText(value: unknown, limit = 1200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function eligibleCreative(asset: Record<string, unknown>, offer: Record<string, unknown>, mode: "paid" | "organic") {
  return asset.business_email === offer.business_email &&
    (!asset.offer_id || asset.offer_id === offer.id) &&
    asset.is_active === true && !asset.archived_at &&
    (mode === "paid" ? asset.allow_paid === true : asset.allow_organic === true);
}

export function buildPromotionContext(
  offer: Record<string, unknown>,
  business: Record<string, unknown> | null,
  assets: Record<string, unknown>[],
  mode: "paid" | "organic",
) {
  const brand = cleanContextText(business?.business_name, 160);
  const description = cleanContextText(offer.description, 2500);
  const headline = cleanContextText(offer.profile_headline, 250);
  const bio = cleanContextText(offer.profile_bio, 1500);
  const examples = assets.filter(asset => eligibleCreative(asset, offer, mode)).slice(0, 3).map(asset => ({
    title: cleanContextText(asset.title, 160),
    caption: cleanContextText(asset.caption, 1600),
    audience: cleanContextText(asset.audience, 300),
    location: cleanContextText(asset.location, 150),
  }));
  const hasContext = !!(description || headline || bio || examples.some(example => example.caption));
  return {
    hasContext,
    limitedContext: !description && !bio,
    sources: [
      "Offer details",
      ...(brand ? ["Business profile"] : []),
      ...(examples.length ? ["Eligible brand content"] : []),
    ],
    // Never send affiliate economics, conversion estimates, credentials, emails, customer data or media URLs.
    context: {
      mode, brandName: brand || null,
      offerTitle: cleanContextText(offer.title, 200), description, headline, bio,
      website: cleanContextText(offer.website, 500),
      examples,
    },
  };
}
