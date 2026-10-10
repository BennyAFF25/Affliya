/**
 * Nettmark campaign intent contract. Keep the affiliate editor, proposal storage,
 * business review and the Meta launch preflight on one definition.
 *
 * This module does NOT control wallet funding, subscription entitlements or
 * Meta account authorisation: those existing server gates remain authoritative.
 */
export type MetaInterest = { id: string; name: string };

export type CampaignIntent = {
  campaign_name?: string | null;
  objective?: string | null;
  budget_amount?: number | string | null; // minor units, from ad_ideas
  budget_type?: string | null;
  currency?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  age_range?: (string | number)[] | null;
  interests?: string | MetaInterest[] | null;
  manual_placements?: string[] | null;
  placements_type?: string | null;
  advantage_audience?: boolean | null;
  media_type?: string | null;
  file_url?: string | null;
  call_to_action?: string | null;
  headline?: string | null;
  caption?: string | null;
  gender?: string | null;
  display_link?: string | null;
  tracking_link?: string | null;
  bid_strategy?: string | null;
  bid_cap?: number | string | null;
};

export const META_PLACEMENTS = [
  "facebook_feed", "instagram_feed", "instagram_reels",
  "facebook_reels", "facebook_stories", "instagram_stories",
] as const;
export type MetaPlacement = (typeof META_PLACEMENTS)[number];

const availableObjectives = new Set([
  "OUTCOME_TRAFFIC", "OUTCOME_SALES", "OUTCOME_LEADS",
  "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_APP_PROMOTION",
]);
const availableCtas = new Set(["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "DOWNLOAD", "APPLY_NOW"]);

export function readMetaInterests(value: unknown): MetaInterest[] {
  if (value == null || value === "") return [];
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { throw new Error("Select interests from Meta suggestions, rather than entering plain text."); }
  }
  if (!Array.isArray(parsed)) throw new Error("Campaign interests must be a list.");
  if (parsed.length > 20) throw new Error("Choose no more than 20 interests.");
  return parsed.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Select interests from Meta suggestions, rather than entering plain text.");
    }
    const interest = item as Record<string, unknown>;
    const id = String(interest.id || "").trim();
    const name = String(interest.name || "").trim();
    if (!/^\d{2,30}$/.test(id) || !name || name.length > 150) {
      throw new Error("A selected Meta interest is invalid. Remove it and search again.");
    }
    return { id, name };
  }).filter((item, index, array) => array.findIndex((other) => other.id === item.id) === index);
}

export type CampaignValidation = {
  ok: boolean;
  errors: string[];
  interests: MetaInterest[];
  currency: string;
  placements: MetaPlacement[];
};

/** Validate intent before saving or launching; not a substitute for Meta's validate_only ad-set request. */
export function validateCampaignIntent(
  idea: CampaignIntent,
  options: { currency?: string; now?: number; requireMedia?: boolean } = {},
): CampaignValidation {
  const errors: string[] = [];
  const now = options.now ?? Date.now();
  let interests: MetaInterest[] = [];
  try { interests = readMetaInterests(idea.interests); }
  catch (error) { errors.push(error instanceof Error ? error.message : "Invalid Meta interest targeting."); }

  const objective = String(idea.objective || "OUTCOME_TRAFFIC");
  if (!availableObjectives.has(objective)) errors.push("Select a supported campaign objective.");

  const budget = Number(idea.budget_amount);
  if (!Number.isSafeInteger(budget) || budget < 100) {
    errors.push("Enter a budget of at least one currency unit.");
  }
  if (!["DAILY", "LIFETIME"].includes(String(idea.budget_type || ""))) {
    errors.push("Choose a daily or lifetime budget.");
  }

  const currency = String(idea.currency || options.currency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.push("Campaign currency must match the connected Meta ad account.");

  const start = Date.parse(String(idea.start_time || ""));
  const end = Date.parse(String(idea.end_time || ""));
  if (!Number.isFinite(start) || start <= now + 60_000) {
    errors.push("Choose a campaign start time at least two minutes into the future.");
  }
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start) {
    errors.push("Choose an end date later than the start date.");
  }

  const countries = String(idea.location || "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (countries.length < 1 || countries.some((code) => !/^[A-Z]{2}$/.test(code))) {
    errors.push("Choose at least one valid two-letter country code.");
  }

  const ages = Array.isArray(idea.age_range) ? idea.age_range.map(Number) : [];
  if (ages.length !== 2 || !ages.every(Number.isInteger) || ages[0] < 18 || ages[1] > 65 || ages[0] > ages[1]) {
    errors.push("Select an age range between 18 and 65.");
  }
  // Advantage+ audiences with maximum age <65 were rejected in live Meta testing.
  if (idea.advantage_audience && ages.length === 2 && ages[1] < 65) {
    errors.push("Meta Advantage+ Audience requires maximum age 65. Turn it off to keep your chosen age range.");
  }

  const providedPlacements = Array.isArray(idea.manual_placements) ? idea.manual_placements : [];
  const placements = providedPlacements.filter((p): p is MetaPlacement =>
    (META_PLACEMENTS as readonly string[]).includes(p),
  );
  if (providedPlacements.length !== placements.length) errors.push("An unsupported Meta placement was selected.");
  if (String(idea.placements_type || "MANUAL") === "MANUAL" && placements.length === 0) {
    errors.push("Choose at least one ad placement.");
  }

  if (!availableCtas.has(String(idea.call_to_action || "LEARN_MORE").toUpperCase())) {
    errors.push("Choose a supported ad button.");
  }
  if (options.requireMedia && (!idea.file_url || !["IMAGE", "VIDEO"].includes(String(idea.media_type || "").toUpperCase()))) {
    errors.push("Choose a supported image or video creative.");
  }
  if (idea.bid_strategy === "BID_CAP" && !(Number(idea.bid_cap) > 0)) {
    errors.push("Enter a valid bid cap.");
  }
  return { ok: errors.length === 0, errors, interests, currency, placements };
}

/**
 * The launch-only contract is intentionally stricter than an editable draft.
 * Called by the business readiness endpoint AND both launch routes before
 * changing any campaign status or sending requests to Meta.
 */
export function validateLaunchProposal(
  idea: CampaignIntent,
  options: { currency?: string; now?: number } = {},
): CampaignValidation {
  const base = validateCampaignIntent(idea, { ...options, requireMedia: true });
  const errors = [...base.errors];
  if (!String(idea.objective || "").trim()) errors.push("Campaign objective is missing.");
  if (!String(idea.headline || "").trim()) errors.push("Ad headline is missing. Ask the affiliate to submit a corrected proposal.");
  if (!String(idea.caption || "").trim()) errors.push("Ad primary text is missing.");
  if (!String(idea.call_to_action || "").trim()) errors.push("Ad call-to-action is missing.");
  if (!["All", "Male", "Female"].includes(String(idea.gender || ""))) {
    errors.push("Gender targeting is missing or unsupported.");
  }
  if (typeof idea.advantage_audience !== "boolean") errors.push("Advantage+ Audience setting is missing.");
  if (!["MANUAL", "AUTOMATIC"].includes(String(idea.placements_type || ""))) {
    errors.push("Placements selection is missing or unsupported.");
  }
  if (idea.placements_type === "MANUAL" && base.placements.length === 0) {
    errors.push("Choose a supported ad placement.");
  }
  if (!["IMAGE", "VIDEO"].includes(String(idea.media_type || "").toUpperCase())) {
    errors.push("Creative format must be an image or video.");
  }
  const isHttpUrl = (value: unknown) => {
    try {
      const url = new URL(String(value || ""));
      return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
    } catch { return false; }
  };
  if (!isHttpUrl(idea.file_url)) errors.push("Creative file URL is missing or invalid.");
  if (!isHttpUrl(idea.display_link)) errors.push("Ad destination URL is missing or invalid.");
  if (!isHttpUrl(idea.tracking_link)) errors.push("Attribution tracking URL is missing or invalid.");
  const accountCurrency = String(options.currency || "").toUpperCase();
  if (accountCurrency && base.currency !== accountCurrency) {
    errors.push("The saved campaign currency does not match the business Meta account.");
  }
  // A schema update must never cause a missing value to be silently defaulted
  // by the Meta API builder. The proposal is immutable after submission.
  return { ...base, ok: errors.length === 0, errors };
}

/** Pure, deterministic payload mapping. No network calls or side effects. */
export function buildSavedMetaTargeting(idea: CampaignIntent) {
  const countries = String(idea.location || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const age = Array.isArray(idea.age_range) ? idea.age_range.map(Number) : [];
  const placements = Array.isArray(idea.manual_placements) ? idea.manual_placements : [];
  const mapFb: Record<string, string> = { facebook_feed: "feed", facebook_stories: "story", facebook_reels: "reels" };
  const mapIg: Record<string, string> = { instagram_feed: "stream", instagram_stories: "story", instagram_reels: "reels" };
  const facebook_positions = placements.filter((item) => item in mapFb).map((item) => mapFb[item]);
  const instagram_positions = placements.filter((item) => item in mapIg).map((item) => mapIg[item]);
  const publisher_platforms = [
    ...(facebook_positions.length > 0 ? ["facebook"] : []),
    ...(instagram_positions.length > 0 ? ["instagram"] : []),
  ];
  const interests = readMetaInterests(idea.interests);
  return {
    geo_locations: { countries },
    age_min: age[0],
    age_max: age[1],
    genders: idea.gender === "Male" ? [1] : idea.gender === "Female" ? [2] : [1, 2],
    ...(publisher_platforms.length ? { publisher_platforms } : {}),
    ...(facebook_positions.length ? { facebook_positions } : {}),
    ...(instagram_positions.length ? { instagram_positions } : {}),
    ...(interests.length ? { flexible_spec: [{ interests: interests.map(({ id }) => ({ id })) }] } : {}),
    targeting_automation: { advantage_audience: idea.advantage_audience ? 1 : 0 },
  };
}

/** Fields used by BOTH image link_data and video_data. Campaign name is deliberately excluded. */
export function buildSavedMetaCreative(idea: CampaignIntent) {
  return {
    headline: String(idea.headline || "").trim(),
    caption: String(idea.caption || "").trim(),
    ctaType: String(idea.call_to_action || "").trim().toUpperCase(),
    destinationLink: String(idea.tracking_link || "").trim(),
    displayLink: String(idea.display_link || "").trim(),
  };
}
