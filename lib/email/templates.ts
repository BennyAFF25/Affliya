import { renderNettmarkEmail } from "../../utils/email/renderNettmarkEmail";

const APP_URL = "https://www.nettmark.com";

export function affiliateWelcomeEmail(params: { affiliateEmail: string }) {
  const subject = "Welcome to Nettmark — your affiliate account is live";
  const html = renderNettmarkEmail({
    previewText: "Your affiliate account is ready. Browse offers and start promoting.",
    badge: { text: "Affiliate account", tone: "success" },
    heading: "Welcome to Nettmark",
    body:
      "Your affiliate account is ready. You can browse offers, request access where required, and start building organic or paid promotion from one place.",
    notice: {
      title: "What happens next",
      body: "Open the marketplace, choose an offer that makes sense for you, and follow the promotion flow. Nettmark will surface the setup you need only when it becomes relevant.",
      tone: "info",
    },
    cta: { label: "Open affiliate dashboard", href: `${APP_URL}/affiliate/dashboard` },
    secondaryCta: { label: "Browse marketplace", href: `${APP_URL}/affiliate/marketplace` },
    footerNote: "If you did not create a Nettmark account, you can ignore this email.",
  });
  return { subject, html };
}

export function businessWelcomeEmail(params: { businessEmail: string }) {
  const subject = "Welcome to Nettmark — publish your first offer";
  const html = renderNettmarkEmail({
    previewText: "Your business account is ready. Publish your first offer to become discoverable.",
    badge: { text: "Business account", tone: "success" },
    heading: "Your Nettmark account is ready",
    body:
      "Start by publishing the offer affiliates will promote. You can choose your commission and marketplace access first; Meta, tracking, and other setup only become necessary when the next action actually needs them.",
    notice: {
      title: "First milestone",
      body: "Publish your first offer so affiliates can discover your business and decide whether they want to promote it.",
      tone: "info",
    },
    cta: { label: "Create your first offer", href: `${APP_URL}/onboarding/for-business` },
    secondaryCta: { label: "Open Nettmark", href: `${APP_URL}/login/business` },
    footerNote: "Free remains available. Growth can be activated later when you want access to affiliate-funded paid advertising.",
  });
  return { subject, html };
}

export function adminNewUserEmail(params: { userEmail: string; role: "affiliate" | "business" }) {
  const subject = `🚀 New ${params.role} signup: ${params.userEmail}`;
  const html = renderNettmarkEmail({
    previewText: `New ${params.role} signup on Nettmark.`,
    badge: { text: "Founder alert", tone: "info" },
    heading: `New ${params.role} signup`,
    body: "A new user has entered Nettmark.",
    rows: [
      { label: "Role", value: params.role },
      { label: "Email", value: params.userEmail },
    ],
    cta: { label: "Open Nettmark", href: APP_URL },
    recipientNote: "Internal Nettmark notification.",
  });
  return { subject, html };
}

export function adminNewOfferEmail(params: { businessEmail: string; offerTitle?: string; offerId?: string }) {
  const subject = `📦 New offer submitted: ${params.offerTitle || "(untitled)"}`;
  const offerHref = params.offerId
    ? `${APP_URL}/affiliate/marketplace/${encodeURIComponent(params.offerId)}`
    : `${APP_URL}/affiliate/marketplace`;
  const html = renderNettmarkEmail({
    previewText: "A new offer has been published on Nettmark.",
    badge: { text: "Founder alert", tone: "info" },
    heading: "New offer published",
    body: "A business has published an offer to the Nettmark marketplace.",
    rows: [
      { label: "Business", value: params.businessEmail },
      { label: "Offer", value: params.offerTitle || "(untitled)" },
      ...(params.offerId ? [{ label: "Offer ID", value: params.offerId }] : []),
    ],
    cta: { label: "View offer", href: offerHref },
    recipientNote: "Internal Nettmark notification.",
  });
  return { subject, html };
}

export function businessNewAffiliateRequestEmail(params: {
  businessEmail: string;
  affiliateEmail: string;
  affiliateName?: string;
  offerTitle?: string;
  notes?: string;
}) {
  const subject = `New affiliate request${params.offerTitle ? ` — ${params.offerTitle}` : ""}`;
  const html = renderNettmarkEmail({
    previewText: "An affiliate wants to promote one of your offers.",
    badge: { text: "Affiliate request", tone: "info" },
    heading: "An affiliate wants to promote your offer",
    body: "Review the request and decide whether this affiliate should be able to promote your business.",
    rows: [
      { label: "Offer", value: params.offerTitle || "Your offer" },
      { label: "Affiliate", value: params.affiliateName || "Nettmark affiliate" },
      ...(params.notes ? [{ label: "Notes", value: params.notes }] : []),
    ],
    cta: {
      label: "Review request",
      href: `${APP_URL}/business/my-business/affiliate-requests`,
    },
    footerNote: "Approving a request gives that affiliate access to the promotion flow for this offer.",
  });
  return { subject, html };
}

export function affiliateRequestDecisionEmail(params: {
  affiliateEmail: string;
  offerTitle?: string;
  decision: "approved" | "rejected";
  note?: string;
}) {
  const approved = params.decision === "approved";
  const subject = approved
    ? `Approved to promote ${params.offerTitle || "this offer"}`
    : `Promotion request update — ${params.offerTitle || "Nettmark offer"}`;

  const html = renderNettmarkEmail({
    previewText: approved
      ? "Your request was approved. You can continue into the promotion flow."
      : "The business has reviewed your promotion request.",
    badge: {
      text: approved ? "Request approved" : "Request declined",
      tone: approved ? "success" : "neutral",
    },
    heading: approved ? "You're approved to promote" : "Your request wasn't approved",
    body: approved
      ? "The business approved your request. Open the offer to continue into organic or paid promotion."
      : "The business has decided not to approve this promotion request right now.",
    rows: [
      { label: "Offer", value: params.offerTitle || "Nettmark offer" },
      ...(params.note ? [{ label: "Business note", value: params.note }] : []),
    ],
    cta: approved
      ? { label: "Open offer", href: `${APP_URL}/affiliate/dashboard` }
      : { label: "Browse other offers", href: `${APP_URL}/affiliate/marketplace` },
  });
  return { subject, html };
}

export function adDecisionEmail(params: {
  affiliateEmail: string;
  offerTitle?: string;
  decision: "approved" | "rejected";
  note?: string;
}) {
  const approved = params.decision === "approved";
  const subject = approved
    ? `Ad approved — ${params.offerTitle || "your campaign"}`
    : `Ad review update — ${params.offerTitle || "your campaign"}`;

  const html = renderNettmarkEmail({
    previewText: approved
      ? "Your ad was approved by the business."
      : "The business has reviewed your ad.",
    badge: {
      text: approved ? "Ad approved" : "Ad rejected",
      tone: approved ? "success" : "danger",
    },
    heading: approved ? "Your ad is approved" : "Your ad wasn't approved",
    body: approved
      ? "The business approved your creative. Open Nettmark to continue with the campaign."
      : "The business has rejected this ad creative. Review any feedback before creating the next version.",
    rows: [
      { label: "Offer", value: params.offerTitle || "Nettmark offer" },
      ...(params.note ? [{ label: "Business note", value: params.note }] : []),
    ],
    cta: { label: "Open Nettmark", href: `${APP_URL}/affiliate/dashboard` },
  });
  return { subject, html };
}
