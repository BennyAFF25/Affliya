import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { formatPublicUsername } from "../../../../utils/profileIdentity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Identity = { id: string; email: string; role: "business" | "affiliate" };
type Contact = {
  key: string; offerId: string; offerTitle: string;
  businessUserId: string; affiliateUserId: string;
  displayName: string; partnerRole: "business" | "affiliate";
};
const allowedStates = ["approved", "active", "accepted"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function context() {
  const session = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user?.email) return null;
  const admin = createServerSupabaseClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("id,email,role").eq("id", user.id).maybeSingle();
  if (profileError || !profile || !["business", "affiliate"].includes(profile.role)) return null;
  return { admin, identity: { id: user.id, email: user.email.toLowerCase(), role: profile.role } as Identity };
}

// Conversation membership comes from Nettmark's existing approved
// offer participation—not arbitrary client-supplied IDs or email addresses.
async function allowedContacts(admin: ReturnType<typeof createServerSupabaseClient>, user: Identity): Promise<Contact[]> {
  const column = user.role === "business" ? "business_email" : "affiliate_email";
  const { data: requests, error: requestsError } = await admin.from("affiliate_requests")
    .select("offer_id,business_email,affiliate_email,status")
    .ilike(column, user.email).in("status", allowedStates).limit(400);
  if (requestsError) throw requestsError;
  if (!requests?.length) return [];

  const partnerEmails = Array.from(new Set(requests.map((r) =>
    String(user.role === "business" ? r.affiliate_email : r.business_email).toLowerCase()
  )));
  const offerIds = Array.from(new Set(requests.map((r) => r.offer_id).filter(Boolean)));
  const [profilesResult, offersResult] = await Promise.all([
    admin.from("profiles").select("id,email,role,username").in("email", partnerEmails),
    admin.from("offers").select("id,title,business_email").in("id", offerIds),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (offersResult.error) throw offersResult.error;
  const profiles = new Map((profilesResult.data || []).map((p) => [String(p.email).toLowerCase(), p]));
  const offers = new Map((offersResult.data || []).map((o) => [o.id, o]));
  const businessEmails = user.role === "affiliate" ? partnerEmails : [];
  const nameResult = businessEmails.length
    ? await admin.from("business_profiles").select("business_email,business_name").in("business_email", businessEmails)
    : { data: [], error: null };
  if (nameResult.error) console.warn("[inbox/chat] business name lookup failed");
  // An old onboarding fallback sometimes persisted the login email as the
  // 'business_name'. Never expose a private email as a partner display name.
  const businessNames = new Map((nameResult.data || []).map((p) => {
    const name = String(p.business_name || "").trim();
    return [String(p.business_email).toLowerCase(),
      name && !/\S+@\S+\.\S+/.test(name) ? name : "Business"];
  }));

  const unique = new Map<string, Contact>();
  for (const row of requests) {
    const businessEmail = String(row.business_email || "").toLowerCase();
    const affiliateEmail = String(row.affiliate_email || "").toLowerCase();
    const offer = offers.get(row.offer_id);
    if (!offer || String(offer.business_email).toLowerCase() !== businessEmail) continue;
    const partner = profiles.get(user.role === "business" ? affiliateEmail : businessEmail);
    if (!partner || partner.role !== (user.role === "business" ? "affiliate" : "business")) continue;
    const businessUserId = user.role === "business" ? user.id : partner.id;
    const affiliateUserId = user.role === "affiliate" ? user.id : partner.id;
    const key = [row.offer_id, businessUserId, affiliateUserId].join(":");
    unique.set(key, {
      key,
      offerId: row.offer_id,
      offerTitle: String(offer.title || "Nettmark offer"),
      businessUserId, affiliateUserId,
      displayName: user.role === "business"
        ? formatPublicUsername(partner.username)
        : businessNames.get(businessEmail) || "Business",
      partnerRole: user.role === "business" ? "affiliate" : "business",
    });
  }
  return [...unique.values()];
}

export async function GET(request: Request) {
  try {
    const ctx = await context();
    if (!ctx) return fail("Sign in to your business or affiliate account.", 401);
    const contacts = await allowedContacts(ctx.admin, ctx.identity);
    const summaryOnly = new URL(request.url).searchParams.get("unread") === "1";
    if (!contacts.length) {
      return NextResponse.json(summaryOnly
        ? { success: true, unreadCount: 0 }
        : { success: true, contacts: [], messages: [], viewerId: ctx.identity.id },
        { headers: { "Cache-Control": "private, no-store" } });
    }
    if (summaryOnly) {
      // Only count messages addressed to this user in current approved
      // offer relationships, never pending/previously revoked partnerships.
      const { data: unread, error: unreadError } = await ctx.admin.from("inbox_chat_messages")
        .select("offer_id,business_user_id,affiliate_user_id")
        .or("business_user_id.eq." + ctx.identity.id + ",affiliate_user_id.eq." + ctx.identity.id)
        .neq("sender_user_id", ctx.identity.id).is("read_at", null).limit(3000);
      if (unreadError) throw unreadError;
      const approvedKeys = new Set(contacts.map((c) => c.key));
      const unreadCount = (unread || []).filter((m) => approvedKeys.has(
        [m.offer_id, m.business_user_id, m.affiliate_user_id].join(":")
      )).length;
      return NextResponse.json({ success: true, unreadCount }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const { data, error } = await ctx.admin.from("inbox_chat_messages")
      .select("id,offer_id,business_user_id,affiliate_user_id,sender_user_id,body,created_at,read_at")
      .or("business_user_id.eq." + ctx.identity.id + ",affiliate_user_id.eq." + ctx.identity.id)
      .order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    const allowed = new Set(contacts.map((c) => c.key));
    const messages = (data || []).filter((m) => allowed.has(
      [m.offer_id, m.business_user_id, m.affiliate_user_id].join(":")
    )).map((m) => ({
      id: m.id, key: [m.offer_id, m.business_user_id, m.affiliate_user_id].join(":"),
      senderId: m.sender_user_id, body: m.body, createdAt: m.created_at, readAt: m.read_at,
    }));
    return NextResponse.json({ success: true, contacts, messages, viewerId: ctx.identity.id }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[inbox/chat] load failed", error);
    return fail("Could not load conversations.", 503);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context();
    if (!ctx) return fail("Sign in to send a message.", 401);
    const body = await request.json().catch(() => null);
    const offerId = String(body?.offerId || "");
    const affiliateUserId = String(body?.affiliateUserId || "");
    const clientMessageId = String(body?.clientMessageId || "");
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!uuid.test(offerId) || !uuid.test(affiliateUserId) || !uuid.test(clientMessageId) ||
        text.length < 1 || text.length > 3000) return fail("Enter a message under 3,000 characters.", 400);
    const contacts = await allowedContacts(ctx.admin, ctx.identity);
    const contact = contacts.find((c) => c.offerId === offerId && c.affiliateUserId === affiliateUserId);
    if (!contact) return fail("You can message only affiliates and businesses with an approved offer relationship.", 403);
    // Lightweight guard against spamming while preserving normal conversations.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: rateError } = await ctx.admin.from("inbox_chat_messages")
      .select("id", { count: "exact", head: true }).eq("sender_user_id", ctx.identity.id).gte("created_at", since);
    if (rateError) throw rateError;
    if ((count || 0) >= 15) return fail("Too many messages. Try again in a minute.", 429);
    const { error } = await ctx.admin.from("inbox_chat_messages").upsert({
      offer_id: contact.offerId, business_user_id: contact.businessUserId,
      affiliate_user_id: contact.affiliateUserId, sender_user_id: ctx.identity.id,
      client_message_id: clientMessageId, body: text,
    }, { onConflict: "sender_user_id,client_message_id", ignoreDuplicates: true });
    if (error) throw error;
    // Read by the idempotency key, including duplicate retries. Never invent a sent timestamp.
    const { data: saved, error: readError } = await ctx.admin.from("inbox_chat_messages")
      .select("id,offer_id,business_user_id,affiliate_user_id,sender_user_id,body,created_at,read_at")
      .eq("sender_user_id", ctx.identity.id).eq("client_message_id", clientMessageId).single();
    if (readError || !saved) throw readError || new Error("Message read-back failed");
    const message = { id: saved.id, key: [saved.offer_id, saved.business_user_id, saved.affiliate_user_id].join(":"),
      senderId: saved.sender_user_id, body: saved.body, createdAt: saved.created_at, readAt: saved.read_at };
    return NextResponse.json({ success: true, message }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[inbox/chat] send failed", error);
    return fail("Message could not be sent. Try again.", 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await context();
    if (!ctx) return fail("Sign in to view messages.", 401);
    const data = await request.json().catch(() => null);
    const offerId = String(data?.offerId || "");
    const affiliateUserId = String(data?.affiliateUserId || "");
    if (!uuid.test(offerId) || !uuid.test(affiliateUserId)) return fail("Invalid conversation.", 400);
    const contacts = await allowedContacts(ctx.admin, ctx.identity);
    const contact = contacts.find((c) => c.offerId === offerId && c.affiliateUserId === affiliateUserId);
    if (!contact) return fail("Conversation unavailable.", 403);
    const { error } = await ctx.admin.from("inbox_chat_messages").update({ read_at: new Date().toISOString() })
      .eq("offer_id", contact.offerId).eq("business_user_id", contact.businessUserId)
      .eq("affiliate_user_id", contact.affiliateUserId)
      .neq("sender_user_id", ctx.identity.id).is("read_at", null);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[inbox/chat] read update failed", error);
    return fail("Could not mark messages as read.", 503);
  }
}
