import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  maskEmail,
  sendInboxNotificationEmail,
} from "../../../utils/email/sendInboxNotificationEmail";

const REQUIRED_FIELDS = [
  "sender_email",
  "sender_role",
  "recipient_email",
  "recipient_role",
  "message_type",
  "title",
  "body",
] as const;

const SENDER_ROLES = new Set(["affiliate", "business", "admin", "system"]);
const RECIPIENT_ROLES = new Set(["affiliate", "business", "admin"]);
const MESSAGE_TYPES = new Set([
  "message",
  "launch_invite",
  "question",
  "system_nudge",
]);

type InboxInsertClient = {
  from: (table: string) => {
    insert: (rows: unknown[]) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: { id?: string } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  for (const field of REQUIRED_FIELDS) {
    if (!body?.[field] || typeof body[field] !== "string") {
      return NextResponse.json({ error: `missing_${field}` }, { status: 400 });
    }
  }

  if (body.sender_email !== user.email) {
    return NextResponse.json({ error: "sender_mismatch" }, { status: 403 });
  }

  if (!SENDER_ROLES.has(body.sender_role)) {
    return NextResponse.json({ error: "invalid_sender_role" }, { status: 400 });
  }

  if (!RECIPIENT_ROLES.has(body.recipient_role)) {
    return NextResponse.json(
      { error: "invalid_recipient_role" },
      { status: 400 },
    );
  }

  if (!MESSAGE_TYPES.has(body.message_type)) {
    return NextResponse.json(
      { error: "invalid_message_type" },
      { status: 400 },
    );
  }

  const row = {
    sender_email: body.sender_email,
    sender_role: body.sender_role,
    sender_name: body.sender_name || null,
    recipient_email: body.recipient_email,
    recipient_role: body.recipient_role,
    message_type: body.message_type,
    title: body.title,
    body: body.body,
    preview: body.preview || String(body.body).slice(0, 180),
    offer_id: body.offer_id || null,
    campaign_id: body.campaign_id || null,
    affiliate_request_id: body.affiliate_request_id || null,
    cta_label: body.cta_label || null,
    cta_url: body.cta_url || null,
    metadata: body.metadata || {},
  };

  const inboxDb = supabase as unknown as InboxInsertClient;
  const { data, error } = await inboxDb
    .from("inbox_messages")
    .insert([row])
    .select("id")
    .single();

  if (error) {
    console.error("[inbox-messages] insert failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 400 });
  }

  if (!body.suppressEmail) {
    try {
      const emailResult = await sendInboxNotificationEmail({
        to: row.recipient_email,
        title: row.title,
        body: row.preview || row.body,
        linkUrl: row.cta_url || null,
      });

      if (emailResult.ok && "skipped" in emailResult && emailResult.skipped) {
        console.warn("[inbox-messages] email notification skipped", {
          recipient: maskEmail(row.recipient_email),
          reason: emailResult.reason,
        });
      }
    } catch (emailError: unknown) {
      console.warn("[inbox-messages] email notification failed", {
        recipient: maskEmail(row.recipient_email),
        message: errorMessage(emailError),
      });
    }
  }

  return NextResponse.json({ ok: true, id: data?.id || null });
}
