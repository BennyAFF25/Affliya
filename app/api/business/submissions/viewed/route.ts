import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";

const TABLE_BY_TYPE = {
  ad: "ad_ideas",
  organic: "organic_posts",
} as const;

type SubmissionType = keyof typeof TABLE_BY_TYPE;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type || "") as SubmissionType;
    const id = String(body?.id || "").trim();
    const table = TABLE_BY_TYPE[type];

    if (!table || !id) {
      return NextResponse.json(
        { ok: false, error: "A valid submission type and id are required." },
        { status: 400 },
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: submission, error: fetchError } = await (supabaseAdmin as any)
      .from(table)
      .select("id,business_email,business_viewed_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!submission?.id) {
      return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
    }

    if (
      String(submission.business_email || "").toLowerCase() !==
      String(user.email).toLowerCase()
    ) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (submission.business_viewed_at) {
      return NextResponse.json({
        ok: true,
        business_viewed_at: submission.business_viewed_at,
        alreadyViewed: true,
      });
    }

    const viewedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await (supabaseAdmin as any)
      .from(table)
      .update({ business_viewed_at: viewedAt })
      .eq("id", id)
      .is("business_viewed_at", null)
      .select("business_viewed_at")
      .maybeSingle();

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      business_viewed_at: updated?.business_viewed_at || viewedAt,
      alreadyViewed: false,
    });
  } catch (error) {
    console.error("[business/submissions/viewed]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
