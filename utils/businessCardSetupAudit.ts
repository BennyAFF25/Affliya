import { writeMoneyFlowAudit } from "./moneyFlowAudit";
import { businessCardSetupMessage } from "./businessCardSetup";

const safeCode = (value: unknown) => typeof value === "string" && /^[a-z_]{1,80}$/.test(value) ? value : undefined;
export async function logBusinessCardSetupFailure(
  database: Parameters<typeof writeMoneyFlowAudit>[0],
  profile: { id: string; business_email: string },
  input: { code?: unknown; decline_code?: unknown; type?: unknown; setup_intent?: unknown; message?: unknown },
  sourceRoute: string,
) {
  const code = safeCode(input.code);
  const declineCode = safeCode(input.decline_code);
  const type = safeCode(input.type);
  const setupIntentId = typeof input.setup_intent === "string" && /^seti_[A-Za-z0-9]+$/.test(input.setup_intent) ? input.setup_intent : null;
  // Never persist arbitrary Stripe/browser messages: they can contain card or personal details.
  return writeMoneyFlowAudit(database, {
    eventType: "business_card_setup_failed", severity: "warning", sourceRoute,
    entityType: "setup_intent", entityId: setupIntentId,
    businessId: profile.id, businessEmail: profile.business_email,
    reasonCode: declineCode || code || "setup_failed",
    message: businessCardSetupMessage({ code, decline_code: declineCode }),
    metadata: { code: code || null, decline_code: declineCode || null, type: type || null, setup_intent: setupIntentId },
  });
}
