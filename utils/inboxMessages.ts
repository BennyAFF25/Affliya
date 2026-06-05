export type InboxMessageType =
  | "message"
  | "launch_invite"
  | "question"
  | "system_nudge";
export type InboxRole = "affiliate" | "business" | "admin" | "system";
export type InboxRecipientRole = "affiliate" | "business" | "admin";

export type CreateInboxMessagePayload = {
  sender_email: string;
  sender_role: InboxRole;
  sender_name?: string | null;
  recipient_email: string;
  recipient_role: InboxRecipientRole;
  message_type: InboxMessageType;
  title: string;
  body: string;
  preview?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  offer_id?: string | null;
  campaign_id?: string | null;
  affiliate_request_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createInboxMessage(payload: CreateInboxMessagePayload) {
  const response = await fetch("/api/inbox-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message = json?.error || "Failed to create inbox message";
    throw new Error(message);
  }

  return json;
}
