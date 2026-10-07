import {
  createAffiliateWebhookTestPayload,
  sendAffiliateEvent,
} from "../utils/affiliateAssistantWebhook";

const payload = createAffiliateWebhookTestPayload();
const result = await sendAffiliateEvent(payload);

console.log(
  payload.type,
  result.status,
  result.ok ? "accepted" : result.disabled ? "disabled" : "rejected",
  "attempts=" + result.attempts,
);

if (!result.ok) {
  if (result.missing.length > 0) {
    console.error("Missing:", result.missing.join(", "));
  }
  if (result.error) {
    console.error("Error:", result.error);
  }
  process.exitCode = 1;
}
