import { renderNettmarkEmail, type NettmarkEmailTone } from "./renderNettmarkEmail";
import type { NotificationKind } from "./notificationOutbox";

type Payload = Record<string, unknown>;
type EmailContent = { subject: string; html: string };
type Copy = {
  subject: string; heading: string; body: string;
  tone?: NettmarkEmailTone; badge?: string; href?: string; cta?: string;
  note?: string;
};

const ROOT = "https://www.nettmark.com";
const BILLING = ROOT + "/business/settings";
const WALLET = ROOT + "/affiliate/wallet";
const CAMPAIGNS = ROOT + "/affiliate/manage-campaigns";
const BIZ_CAMPAIGNS = ROOT + "/business/my-business/ad-ideas";
const AFFILIATE_INBOX = ROOT + "/affiliate/inbox";
const BUSINESS_INBOX = ROOT + "/business/inbox";

function money(payload: Payload, key = "amount_cents") {
  const raw = payload[key];
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) return null;
  const currency = String(payload.currency || "aud").toUpperCase();
  if (currency !== "AUD") return null; // no incorrect currency conversion
  return "A$" + (raw / 100).toFixed(2);
}
function appendAmount(copy: Copy, value: string | null) {
  return value ? { ...copy, body: copy.body + "\nAmount: " + value + "." } : copy;
}
function copyFor(kind: NotificationKind, payload: Payload): Copy {
  const amount = money(payload);
  switch (kind) {
    case "subscription_payment_failed":
      return appendAmount({ subject: "Action required: your Nettmark Growth payment failed", heading: "We couldn't process your Growth payment", badge: "Payment failed", tone: "warning", body: "Your Growth subscription invoice is unpaid. Update your payment method to help avoid interruption to your subscription.", href: BILLING, cta: "Manage billing" }, amount);
    case "subscription_action_required":
      return { subject: "Complete your Growth payment authentication", heading: "Your Growth payment needs authentication", badge: "Action required", tone: "warning", body: "Your bank may need additional confirmation before your payment succeeds. Open Nettmark billing settings to finish the payment securely.", href: BILLING, cta: "Review payment" };
    case "subscription_reminder_48h":
      return appendAmount({ subject: "Reminder: Growth subscription payment is still outstanding", heading: "Your Growth invoice is still unpaid", badge: "Billing reminder", tone: "warning", body: "Our records show an outstanding Growth invoice. If you've already updated your payment method, please check the current invoice status in Nettmark.", href: BILLING, cta: "Review billing" }, amount);
    case "subscription_reminder_5d":
      return appendAmount({ subject: "Important: your Growth payment remains outstanding", heading: "Please review your overdue Growth payment", badge: "Outstanding payment", tone: "warning", body: "Your Growth invoice is still unpaid. Your access may be affected according to your existing subscription terms. Review your account and payment details.", href: BILLING, cta: "Manage billing" }, amount);
    case "subscription_payment_recovered":
      return appendAmount({ subject: "Your Growth payment has been received", heading: "Your outstanding payment is resolved", badge: "Payment recovered", tone: "success", body: "Thanks. The Growth invoice that was previously unpaid is now paid.", href: BILLING, cta: "View subscription" }, amount);
    case "subscription_receipt":
      return appendAmount({ subject: "Your Nettmark Growth subscription payment receipt", heading: "Your Growth payment was successful", badge: "Payment received", tone: "success", body: "Your Growth subscription invoice has been paid. You can view the invoice and billing details from your Nettmark account.", href: BILLING, cta: "View billing" }, amount);
    case "subscription_trial_converted":
      return { subject: "Your Nettmark Growth subscription is now active", heading: "Your Growth plan is active", badge: "Growth activated", tone: "success", body: "Your trial has converted to the paid Growth plan. Your subscription continues under the billing terms you accepted at checkout.", href: BILLING, cta: "Manage Growth" };
    case "subscription_cancel_scheduled":
      return { subject: "Your Nettmark Growth cancellation is scheduled", heading: "Cancellation scheduled", badge: "Subscription update", tone: "info", body: "Your Growth subscription is set to cancel at the end of the current period. Your existing access continues according to the current billing terms until then.", href: BILLING, cta: "View subscription" };
    case "subscription_cancelled":
      return { subject: "Your Nettmark Growth subscription has ended", heading: "Your Growth subscription has ended", badge: "Subscription ended", tone: "info", body: "Your Growth subscription cancellation has taken effect. You can view your current plan in Nettmark.", href: BILLING, cta: "View current plan" };
    case "wallet_funded":
      return appendAmount({ subject: "Your Nettmark advertising wallet has been credited", heading: "Your wallet top-up is complete", badge: "Wallet credited", tone: "success", body: "Your payment was verified and the wallet credit is now recorded in Nettmark.", href: WALLET, cta: "View wallet" }, amount);
    case "wallet_payment_failed":
      return { subject: "Your Nettmark wallet top-up was unsuccessful", heading: "Your wallet payment didn't complete", badge: "Top-up unsuccessful", tone: "warning", body: "We weren't able to complete this wallet top-up. No new credit has been applied for this failed payment.", href: WALLET, cta: "Review wallet" };
    case "wallet_review":
      return { subject: "Your Nettmark wallet top-up needs review", heading: "We're reviewing your top-up", badge: "Payment review", tone: "warning", body: "Your payment needs additional verification before the wallet can be credited. We have not confirmed the top-up yet.", href: WALLET, cta: "View wallet" };
    case "wallet_refund_succeeded":
      return appendAmount({ subject: "Your Nettmark wallet refund was processed", heading: "Your refund has been processed", badge: "Refund processed", tone: "success", body: "Stripe confirmed your refund. The time for funds to appear on your payment method depends on your payment provider.", href: WALLET, cta: "View wallet" }, amount);
    case "wallet_refund_failed":
      return { subject: "Your Nettmark wallet refund needs attention", heading: "Your refund couldn't be completed", badge: "Refund issue", tone: "warning", body: "Your refund could not be confirmed. Please contact Nettmark support; we will investigate without initiating a second refund automatically.", href: WALLET, cta: "View wallet" };
    case "wallet_low_balance":
      return { subject: "Your Nettmark campaign wallet balance is running low", heading: "Your campaign may run out of funding", badge: "Funding warning", tone: "warning", body: "The wallet balance available for your campaign is running low. Review your campaign and funding to avoid a potential pause.", href: WALLET, cta: "Review wallet" };
    case "campaign_auto_paused":
      return { subject: "A Nettmark campaign was paused due to low funds", heading: "Campaign paused: low funds", badge: "Campaign paused", tone: "warning", body: "Nettmark recorded an automated low-funds pause. Check the campaign and wallet balance before resuming. If the advertising platform shows a different status, contact support.", href: CAMPAIGNS, cta: "View campaigns" };
    case "campaign_launch_failed":
      return { subject: "Your Nettmark campaign did not launch", heading: "Campaign launch unsuccessful", badge: "Campaign update", tone: "warning", body: "The attempted campaign launch didn't complete. Review the campaign in Nettmark before retrying.", href: CAMPAIGNS, cta: "Review campaigns" };
    case "campaign_resumed":
      return { subject: "Your Nettmark campaign has resumed", heading: "Campaign resumed", badge: "Campaign update", tone: "success", body: "The campaign resume action has been confirmed. You can monitor its status from your Nettmark dashboard.", href: CAMPAIGNS, cta: "View campaigns" };
    case "campaign_earnings_available":
      return appendAmount({ subject: "Nettmark affiliate earnings are available", heading: "Your affiliate earnings are available", badge: "Earnings update", tone: "success", body: "Confirmed earnings are now available in your Nettmark account. This is not a confirmation of a bank payout.", href: WALLET, cta: "View earnings" }, amount);
    case "payout_transferred":
      return appendAmount({ subject: "Nettmark affiliate payout transferred to Stripe", heading: "Your payout was transferred", badge: "Transfer confirmed", tone: "success", body: "Nettmark confirmed the transfer to your connected Stripe account. This does not mean the funds have arrived in your bank account.", href: WALLET, cta: "View payouts" }, amount);
    case "payout_failed":
      return { subject: "Your Nettmark affiliate payout needs attention", heading: "Payout transfer unsuccessful", badge: "Payout issue", tone: "warning", body: "Nettmark could not confirm a successful payout transfer. The payout is being reviewed. Do not retry the payment yourself.", href: WALLET, cta: "View payouts" };
    case "partner_message": {
      const affiliate = payload.recipient_role === "affiliate";
      return { subject: "You have a new partner message on Nettmark", heading: "A partner sent you a message", badge: "New message", tone: "info", body: "You have an unread conversation message waiting in Nettmark.", href: affiliate ? AFFILIATE_INBOX : BUSINESS_INBOX, cta: "Open inbox" };
    }
    default: {
      const exhaustive: never = kind;
      throw new Error("Unknown notification kind: " + exhaustive);
    }
  }
}
export function buildNotificationEmail(kind: NotificationKind, payload: Payload): EmailContent {
  const copy = copyFor(kind, payload);
  return {
    subject: copy.subject,
    html: renderNettmarkEmail({
      previewText: copy.body, heading: copy.heading,
      body: copy.body, badge: { text: copy.badge || "Nettmark", tone: copy.tone || "info" },
      cta: copy.href ? { href: copy.href, label: copy.cta || "Open Nettmark" } : undefined,
      footerNote: "This is an account notification. Never share your password or card details by email.",
    }),
  };
}
