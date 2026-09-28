import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Patch failed: ${label}`);
  return content.replace(search, replacement);
}

// Authenticate the legacy Meta route so the service-role route cannot be used
// as a second unauthenticated launch entry point.
{
  const path = "app/api/meta/callback/upload-video/route.ts";
  let s = read(path);
  s = replaceOnce(
    s,
    `import { NextResponse } from "next/server";\nimport { createClient } from "@supabase/supabase-js";`,
    `import { NextResponse } from "next/server";\nimport { cookies } from "next/headers";\nimport { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";\nimport { createClient } from "@supabase/supabase-js";`,
    "Meta route auth imports",
  );

  s = replaceOnce(
    s,
    `    if (adIdeaError) {\n      console.warn("[⚠️ ad_ideas lookup warning]", adIdeaError.message);\n    }\n\n    const fallback_image_url = (adIdea as any)?.thumbnail_url || rest.thumbnail_url;`,
    `    if (adIdeaError) {\n      console.warn("[⚠️ ad_ideas lookup warning]", adIdeaError.message);\n    }\n\n    const userSupabase = createRouteHandlerClient({ cookies });\n    const { data: authData, error: authError } = await userSupabase.auth.getUser();\n    const launchUser = authData?.user || null;\n    if (authError || !launchUser?.email) {\n      return NextResponse.json(\n        { success: false, error: "UNAUTHENTICATED", message: "Sign in as the business before launching this campaign." },\n        { status: 401 },\n      );\n    }\n    if (!adIdea || String((adIdea as any).business_email || "").trim().toLowerCase() !== launchUser.email.trim().toLowerCase()) {\n      return NextResponse.json(\n        { success: false, error: "UNAUTHORIZED", message: "Only the offer business can launch this campaign." },\n        { status: 403 },\n      );\n    }\n\n    const fallback_image_url = (adIdea as any)?.thumbnail_url || rest.thumbnail_url;`,
    "Meta route authenticated ownership",
  );

  s = replaceOnce(
    s,
    `    // 2. Lookup access_token from the matching Meta connection first; fallback to latest.`,
    `    // 2. Lookup the access token for the exact Page + Ad Account selected on this offer.`,
    "Meta connection comment",
  );

  s = replaceOnce(
    s,
    `          message: \`Affiliate campaign funding is short by $\{fundingReady.deficit.toFixed(2)}.\`,`,
    `          message: \`Affiliate campaign funding is short by $\${fundingReady.deficit.toFixed(2)}.\`,`,
    "funding error currency",
  );

  write(path, s);
}

// Claim a pending proposal atomically enough for normal double-click/retry cases.
// Only the first request can move pending -> approved before entering Meta.
{
  const path = "app/api/business/ad-ideas/launch/route.ts";
  let s = read(path);
  s = replaceOnce(
    s,
    `    const { error: approveError } = await admin\n      .from("ad_ideas")\n      .update({ status: "approved" })\n      .eq("id", adIdeaId)\n      .eq("business_email", user.email);\n\n    if (approveError) {\n      throw new Error(\`Failed to prepare proposal for launch: $\{approveError.message}\`);\n    }`,
    `    const { data: claimedProposal, error: approveError } = await admin\n      .from("ad_ideas")\n      .update({ status: "approved" })\n      .eq("id", adIdeaId)\n      .eq("business_email", user.email)\n      .eq("status", "pending")\n      .select("id")\n      .maybeSingle();\n\n    if (approveError) {\n      throw new Error(\`Failed to prepare proposal for launch: $\{approveError.message}\`);\n    }\n    if (!claimedProposal?.id) {\n      const existingAfterClaim = await getExistingPaidCampaignLaunch({\n        supabase: admin,\n        adIdeaId,\n      });\n      if (existingAfterClaim?.id) {\n        return NextResponse.json({\n          success: true,\n          alreadyLive: true,\n          liveAdId: existingAfterClaim.id,\n          campaignId: existingAfterClaim.meta_campaign_id || null,\n          metaAdId: existingAfterClaim.meta_ad_id || null,\n        });\n      }\n      return jsonError(\n        "CAMPAIGN_LAUNCH_IN_PROGRESS",\n        "This campaign is already being launched or is no longer pending. Refresh before trying again.",\n        409,\n      );\n    }`,
    "atomic proposal launch claim",
  );

  s = replaceOnce(
    s,
    `        headers: { "Content-Type": "application/json" },`,
    `        headers: {\n          "Content-Type": "application/json",\n          ...(req.headers.get("cookie")\n            ? { cookie: req.headers.get("cookie") as string }\n            : {}),\n        },`,
    "preserve launch authentication",
  );

  write(path, s);
}

console.log("Launch boundary hardening patch applied successfully.");
