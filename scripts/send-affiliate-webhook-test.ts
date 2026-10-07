const webhookUrl = String(process.env.AFFILIATE_WEBHOOK_URL || "").trim();
const webhookKey = String(process.env.AFFILIATE_WEBHOOK_KEY || "").trim();

if (!webhookUrl || !webhookKey) {
  throw new Error(
    "Set AFFILIATE_WEBHOOK_URL and AFFILIATE_WEBHOOK_KEY before sending a test event.",
  );
}

const eventTypes = [
  "brand.signed_up",
  "brand.profile_updated",
  "offer.created",
  "offer.updated",
  "meta.connected",
  "meta.disconnected",
  "plan.upgraded",
  "plan.downgraded",
  "proposal.viewed",
  "proposal.approved",
  "proposal.rejected",
  "proposal.changes_requested",
  "message.received",
  "campaign.launched",
  "campaign.paused",
  "sale.attributed",
  "brand.inactive",
] as const;

const requested = process.argv[2] || "brand.signed_up";
const types =
  requested === "all"
    ? [...eventTypes]
    : eventTypes.filter((type) => type === requested);

if (!types.length) {
  throw new Error("Unknown event type: " + requested);
}

for (const type of types) {
  const payload = {
    event_id:
      "evt_test_" +
      Date.now() +
      "_" +
      type.replace(/\W/g, "_"),
    type,
    occurred_at: new Date().toISOString(),
    brand: {
      id: "test-brand",
      name: "Nettmark Test Brand",
      website: "https://example.com",
      contact_first_name: "Test",
      timezone: "Australia/Adelaide",
      country: "AU",
      plan: "free",
      meta_connected: false,
      signed_up_at: new Date().toISOString(),
      dashboard_url: "https://www.nettmark.com/business/my-business",
    },
    data: type.startsWith("offer.")
      ? {
          offer_id: "test-offer",
          title: "Test offer",
          status: "active",
          commission_type: "percent",
          commission_value: 20,
          currency: "AUD",
          products: [],
          campaign_rules: null,
          allowed_channels: ["facebook_ads", "organic"],
          restricted_claims: [],
          assets: [],
          landing_url: "https://example.com",
          target_audience: null,
        }
      : {},
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      authorization: "Bearer " + webhookKey,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  console.log(
    type,
    response.status,
    response.ok ? "accepted" : "rejected",
  );

  if (!response.ok) process.exitCode = 1;
}
