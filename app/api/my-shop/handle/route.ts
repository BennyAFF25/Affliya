import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const slugRegex = /^[a-z0-9-]{3,20}$/;

export async function PUT(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { handle }: { handle: string } = await request.json();

  const normalized = (handle || "").trim().toLowerCase();
  if (!slugRegex.test(normalized)) {
    return NextResponse.json(
      {
        error: "invalid_handle",
        message:
          "Handle must be 3-20 characters, lowercase letters, numbers, or dashes.",
      },
      { status: 400 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", normalized)
    .neq("id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("[handle] uniqueness check failed", existingError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json(
      { error: "handle_taken", message: "That handle is already in use." },
      { status: 409 },
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ username: normalized })
    .eq("id", user.id);

  if (updateError) {
    console.error("[handle] update failed", updateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, handle: normalized });
}
