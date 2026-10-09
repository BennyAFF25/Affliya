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
