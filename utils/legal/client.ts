import { TERMS_VERSION } from "./version";
import type { LegalAcceptanceContext } from "./acceptance";

/** Browser helper: record acceptance server-side and return the evidence id. */
export async function recordTermsAcceptance(params: {
  context: Exclude<LegalAcceptanceContext, "signup">;
  businessId?: string | null;
  summaryShown?: string | null;
}) {
  const response = await fetch("/api/legal/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document: "terms", version: TERMS_VERSION, context: params.context, businessId: params.businessId || null, summaryShown: params.summaryShown || null }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.acceptanceId) throw new Error(result?.error || "Could not save your acceptance. Please try again.");
  return String(result.acceptanceId);
}
