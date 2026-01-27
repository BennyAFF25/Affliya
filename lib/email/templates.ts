type Base = {
  appName: string;
  brandColor: string; // #00C2CB
  supportEmail?: string;
};

const base: Base = {
  appName: "Nettmark",
  brandColor: "#00C2CB",
  supportEmail: "contact@nettmark.com",
};

function layout(title: string, bodyHtml: string) {
  return `
  <div style="font-family: Arial, sans-serif; background:#0e0e0e; padding:24px;">
    <div style="max-width:640px; margin:0 auto; background:#141414; border:1px solid #222; border-radius:14px; overflow:hidden;">
      <div style="padding:18px 20px; border-bottom:1px solid #222;">
        <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#9ca3af;">${base.appName}</div>
        <div style="margin-top:6px; font-size:20px; color:${base.brandColor}; font-weight:700;">${title}</div>
      </div>

      <div style="padding:18px 20px; color:#e5e7eb; font-size:14px; line-height:1.6;">
        ${bodyHtml}
      </div>

      <div style="padding:14px 20px; border-top:1px solid #222; color:#9ca3af; font-size:12px;">
        Need help? Reply to this email or contact <span style="color:${base.brandColor};">${base.supportEmail}</span>
      </div>
    </div>
  </div>
  `;
}

export function affiliateWelcomeEmail(params: { affiliateEmail: string }) {
  const subject = "Welcome to Nettmark — you’re early 👀";
  const html = layout(
    "Welcome, affiliate",
    `
    <p>You’re officially in Nettmark.</p>

    <p><b>Early access:</b> we’re letting the <b>first 150 users</b> use Nettmark <b>free for life</b> in exchange for honest feedback while we tighten everything.</p>

    <p><b>How it works:</b></p>
    <ul>
      <li>You can run Facebook ads inside Nettmark on <b>brand-owned ad accounts</b> (no messing with Meta Ads Manager).</li>
      <li>Nettmark handles the tracking + approvals + payout flow <b>under one roof</b>.</li>
      <li>You earn <b>commission on sales</b> you generate.</li>
    </ul>

    <p>Log in and head to your dashboard → Marketplace → request an offer → once approved you’ll see it in Manage Campaigns.</p>

    <p style="margin-top:16px;">
      <span style="display:inline-block; background:${base.brandColor}; color:#000; padding:10px 14px; border-radius:10px; font-weight:700;">
        You’re early. Let’s build this properly.
      </span>
    </p>
    `
  );
  return { subject, html };
}

export function businessWelcomeEmail(params: { businessEmail: string }) {
  const subject = "Welcome to Nettmark — let’s get your first affiliates running";
  const html = layout(
    "Welcome, business",
    `
    <p>You’re officially in Nettmark.</p>

    <p><b>What makes Nettmark different:</b> affiliates can run Facebook ads through Nettmark directly on <b>your brand-owned ad account</b>, while Nettmark handles tracking, approvals, and payments inside the platform.</p>

    <p><b>Early access:</b> the first <b>150 users</b> get Nettmark <b>free for life</b> while we gather feedback and polish flows.</p>

    <p>Next steps:</p>
    <ol>
      <li>Create your offer</li>
      <li>Connect Meta</li>
      <li>Approve affiliates + approve ads</li>
      <li>Watch spend + performance inside Manage Campaigns</li>
    </ol>
    `
  );
  return { subject, html };
}

export function adminNewUserEmail(params: { userEmail: string; role: "affiliate" | "business" }) {
  const subject = `🚨 New ${params.role} signup: ${params.userEmail}`;
  const html = layout(
    "New user signup",
    `
    <p><b>Role:</b> ${params.role}</p>
    <p><b>Email:</b> ${params.userEmail}</p>
    <p style="color:#9ca3af; font-size:12px; margin-top:14px;">Sent automatically by Nettmark.</p>
    `
  );
  return { subject, html };
}

export function adminNewOfferEmail(params: { businessEmail: string; offerTitle?: string; offerId?: string }) {
  const subject = `📦 New offer submitted: ${params.offerTitle || "(untitled)"}`;
  const html = layout(
    "New offer submitted",
    `
    <p><b>Business:</b> ${params.businessEmail}</p>
    <p><b>Offer:</b> ${params.offerTitle || "(untitled)"}</p>
    ${params.offerId ? `<p><b>Offer ID:</b> ${params.offerId}</p>` : ""}
    `
  );
  return { subject, html };
}

export function businessNewAffiliateRequestEmail(params: { businessEmail: string; affiliateEmail: string; offerTitle?: string; notes?: string }) {
  const subject = `🧲 New affiliate request: ${params.affiliateEmail}`;
  const html = layout(
    "New affiliate request",
    `
    <p><b>Affiliate:</b> ${params.affiliateEmail}</p>
    ${params.offerTitle ? `<p><b>Offer:</b> ${params.offerTitle}</p>` : ""}
    ${params.notes ? `<p><b>Notes:</b><br/>${escapeHtml(params.notes).replace(/\n/g, "<br/>")}</p>` : ""}
    <p>Open Nettmark → Affiliate Requests to approve or reject.</p>
    `
  );
  return { subject, html };
}

export function affiliateRequestDecisionEmail(params: { affiliateEmail: string; offerTitle?: string; decision: "approved" | "rejected"; note?: string }) {
  const subject = params.decision === "approved"
    ? `✅ Approved to promote: ${params.offerTitle || "an offer"}`
    : `❌ Not approved: ${params.offerTitle || "an offer"}`;

  const html = layout(
    "Affiliate request update",
    `
    <p>Your request to promote <b>${params.offerTitle || "the offer"}</b> was <b>${params.decision.toUpperCase()}</b>.</p>
    ${params.note ? `<p><b>Business note:</b><br/>${escapeHtml(params.note).replace(/\n/g, "<br/>")}</p>` : ""}
    <p>Log in to Nettmark → Dashboard → Manage Campaigns.</p>
    `
  );
  return { subject, html };
}

export function adDecisionEmail(params: { affiliateEmail: string; offerTitle?: string; decision: "approved" | "rejected"; note?: string }) {
  const subject = params.decision === "approved"
    ? `✅ Ad approved: ${params.offerTitle || "your campaign"}`
    : `❌ Ad rejected: ${params.offerTitle || "your campaign"}`;

  const html = layout(
    "Ad review update",
    `
    <p>Your ad for <b>${params.offerTitle || "the offer"}</b> was <b>${params.decision.toUpperCase()}</b>.</p>
    ${params.note ? `<p><b>Note:</b><br/>${escapeHtml(params.note).replace(/\n/g, "<br/>")}</p>` : ""}
    <p>Open Nettmark → Manage Campaigns to view status.</p>
    `
  );
  return { subject, html };
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}