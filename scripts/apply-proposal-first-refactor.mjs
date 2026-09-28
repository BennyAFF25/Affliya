import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, search, replacement, label) {
  const next = content.replace(search, replacement);
  if (next === content) throw new Error(`Patch failed: ${label}`);
  return next;
}

function replaceRegex(content, regex, replacement, label) {
  if (!regex.test(content)) throw new Error(`Patch failed: ${label}`);
  return content.replace(regex, replacement);
}

// ---------------------------------------------------------------------------
// Affiliate promote page: proposal is allowed before wallet / Meta / Pixel.
// ---------------------------------------------------------------------------
{
  const path = "app/affiliate/dashboard/promote/[offerId]/page.tsx";
  let s = read(path);

  s = replaceRegex(
    s,
    /      \/\/ 0\) Ensure budget does not exceed prefunded wallet[\s\S]*?      \/\/ 1\) Get business email for this offer \(needed for row\)/,
    `      // 0) Proposal creation only validates that the campaign has a real budget.\n      // Funding is intentionally re-checked server-side at launch time.\n      const budgetDollars = Number(form.budget_amount_dollars || 0);\n      if (!budgetDollars || budgetDollars <= 0) {\n        nmToast.error("Please enter a valid daily budget");\n        return;\n      }\n\n      // 1) Get business email for this offer (needed for row)`,
    "remove wallet submission gate",
  );

  s = replaceRegex(
    s,
    /\n      if \(!offerHasMetaLaunchSetup\) \{[\s\S]*?\n      if \(form\.objective === "OUTCOME_SALES" && !offerHasSalesPixel\) \{[\s\S]*?\n      \}\n\n      \/\/ 2\) Upload creative media/,
    `\n      // Meta, Sales Pixel, Growth, tracking and wallet readiness are launch\n      // requirements, not proposal requirements. The business can review the\n      // real campaign first and Nettmark will enforce every blocker at launch.\n\n      // 2) Upload creative media`,
    "remove Meta and Pixel proposal gates",
  );

  s = replaceOnce(
    s,
    'nmToast.success("Ad idea submitted for review");',
    'nmToast.success("Campaign proposal submitted — no wallet funds have been reserved.");',
    "proposal success copy",
  );

  s = replaceOnce(
    s,
    'The business hasn\'t enabled paid promotion yet. Tell them you\'re ready to advertise and Nettmark will ask them to connect Meta.',
    'The business hasn\'t finished paid-promotion setup yet. You can still build and submit the real campaign — they will review it before anything can launch.',
    "Meta warning copy",
  );

  s = replaceOnce(
    s,
    'No wallet funds are reserved or deducted by this request.',
    'Submitting a full proposal also reserves no wallet funds. Setup and funding are enforced only before launch.',
    "Meta request helper copy",
  );

  s = replaceOnce(
    s,
    'This offer is Meta-ready for traffic and engagement, but Sales requires a selected Meta pixel on the offer first.',
    'You can submit the Sales proposal now. A selected Meta pixel is still a hard requirement before it can launch.',
    "Sales Pixel proposal copy",
  );

  s = replaceRegex(
    s,
    /\{!showMetaSetupWarning && \(\n\s*(<AdCampaignWizard[\s\S]*?onNavigateToWallet=\{\(\) => router\.push\("\/affiliate\/wallet"\)\}\n\s*\/>)\n\s*\)\}/,
    "$1",
    "always render paid campaign wizard",
  );

  s = replaceOnce(
    s,
    '{!showMetaSetupWarning && adCreativeSource === "brand" && (',
    '{adCreativeSource === "brand" && (',
    "always allow paid brand creative picker",
  );

  write(path, s);
}

// ---------------------------------------------------------------------------
// Campaign wizard: wallet state informs launch readiness but never submission.
// ---------------------------------------------------------------------------
{
  const path = "app/affiliate/dashboard/promote/components/AdCampaignWizard.tsx";
  let s = read(path);

  s = replaceOnce(s, "Wallet guard", "Launch funding", "wallet heading");
  s = replaceOnce(
    s,
    "Top up your wallet before submitting this campaign.",
    "No funds are required to submit this proposal. You’ll need sufficient campaign funding before it can launch.",
    "wallet informational copy",
  );
  s = replaceOnce(
    s,
    " — ready to run this ad",
    " — funded for launch",
    "wallet ready copy 1",
  );
  s = replaceOnce(
    s,
    " — ready to run this ad",
    " — funded for launch",
    "wallet ready copy 2",
  );
  s = replaceOnce(
    s,
    "more to run this ad.",
    "more before this campaign can launch. You can still submit the proposal now.",
    "wallet deficit copy",
  );
  s = replaceOnce(
    s,
    "Action needed",
    "Needed at launch",
    "wallet badge copy",
  );

  s = replaceRegex(
    s,
    /          \{step === 4 &&\n            \(canRunWithWallet \? \([\s\S]*?            \)\)\}\n/,
    `          {step === 4 && (\n            <button\n              onClick={onSubmitClick}\n              disabled={isSubmitting}\n              className={\`sm:ml-auto w-full sm:w-auto px-6 py-2 rounded-md transition flex items-center justify-center gap-2 \${\n                isSubmitting\n                  ? "bg-[#1a1a1a] text-gray-400 cursor-not-allowed"\n                  : "bg-[#00C2CB] text-black hover:bg-[#00b0b8]"\n              }\`}\n            >\n              {isSubmitting ? (\n                <>\n                  <span className="h-4 w-4 rounded-full border-2 border-gray-500 border-t-[#00C2CB] animate-spin" />\n                  Submitting…\n                </>\n              ) : (\n                "Submit Campaign Proposal"\n              )}\n            </button>\n          )}\n`,
    "make proposal submission independent of wallet",
  );

  write(path, s);
}

// ---------------------------------------------------------------------------
// Business review page: one authenticated approve+launch action and current
// per-proposal readiness. Server remains authoritative.
// ---------------------------------------------------------------------------
{
  const path = "app/business/my-business/ad-ideas/page.tsx";
  let s = read(path);

  s = replaceOnce(
    s,
    `  subscription: {\n    ready: boolean;\n    required: boolean;\n    grandfathered: boolean;\n    status: string;\n    businessId?: string | null;\n  };\n};`,
    `  subscription: {\n    ready: boolean;\n    required: boolean;\n    grandfathered: boolean;\n    status: string;\n    businessId?: string | null;\n  };\n  campaigns?: Record<\n    string,\n    {\n      ready: boolean;\n      alreadyLive?: boolean;\n      partialMetaState?: boolean;\n      blockers?: string[];\n      funding?: { ready: boolean; requiredAmount: number; deficit: number };\n      meta?: { ready: boolean; pageReady: boolean; adAccountReady: boolean };\n      tracking?: { ready: boolean; error?: string | null };\n      pixel?: { required: boolean; ready: boolean };\n      timing?: { ready: boolean; error?: string | null; message?: string | null };\n      affiliate?: { ready: boolean };\n      offer?: { ready: boolean };\n      error?: string;\n    }\n  >;\n};`,
    "review readiness type",
  );

  s = replaceOnce(
    s,
    `          setReviewReadiness({\n            billing: json.billing,\n            subscription: json.subscription,\n          });`,
    `          setReviewReadiness({\n            billing: json.billing,\n            subscription: json.subscription,\n            campaigns: json.campaigns || {},\n          });`,
    "store per-campaign readiness",
  );

  s = replaceOnce(
    s,
    `  const launchRequirementsReady = billingReady && (subscriptionReady || !subscriptionRequired);`,
    `  const launchRequirementsReady = billingReady && (subscriptionReady || !subscriptionRequired);\n\n  const campaignReadiness = (id: string) => reviewReadiness?.campaigns?.[id] || null;\n  const isCampaignReady = (id: string) => {\n    const readiness = campaignReadiness(id);\n    return Boolean(readiness?.ready && launchRequirementsReady);\n  };\n  const blockerLabel = (code: string) => {\n    const labels: Record<string, string> = {\n      BUSINESS_GROWTH_REQUIRED: "Start the 14-day Growth trial",\n      BUSINESS_BILLING_REQUIRED: "Connect business billing",\n      AFFILIATE_CAMPAIGN_FUNDING_REQUIRED: "Waiting for affiliate funding",\n      META_SETUP_REQUIRED: "Connect/select Meta Page + Ad Account",\n      META_PAGE_REQUIRED: "Connect/select a Facebook Page",\n      META_AD_ACCOUNT_REQUIRED: "Connect/select a Meta Ad Account",\n      OFFER_TRACKING_NOT_READY: "Connect and verify tracking",\n      TRACKING_REQUIRED: "Connect and verify tracking",\n      SALES_PIXEL_REQUIRED: "Select a Meta Pixel for this Sales campaign",\n      CAMPAIGN_DATES_REQUIRE_UPDATE: "Campaign dates need updating",\n      AFFILIATE_OFFER_NOT_APPROVED: "Affiliate access is no longer approved",\n      OFFER_NOT_AVAILABLE: "Offer is no longer available",\n      CAMPAIGN_PARTIAL_META_STATE: "Previous Meta launch needs recovery before retry",\n      READINESS_CHECK_FAILED: "Could not verify all launch requirements",\n    };\n    return labels[code] || code.replaceAll("_", " ").toLowerCase();\n  };`,
    "campaign readiness helpers",
  );

  s = replaceRegex(
    s,
    /  \/\/ Internal API function to send full ad idea data to Meta\n  const sendToMeta = async \(adIdeaId: string\) => \{[\s\S]*?\n  \};\n\n  return \(/,
    `  // One authenticated launch boundary. The server reloads the proposal and\n  // re-checks Growth, billing, affiliate access, funding, Meta, tracking, Pixel,\n  // dates and idempotency immediately before any Meta creation.\n  const sendToMeta = async (adIdeaId: string) => {\n    try {\n      const response = await fetch("/api/business/ad-ideas/launch", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ adIdeaId }),\n      });\n      const data = await response.json().catch(() => null);\n\n      if (!response.ok || !data?.success) {\n        const intent = readSubscriptionIntentFromResponse(data);\n        if (intent) {\n          setSubscriptionIntent({ ...intent, businessId: intent.businessId || businessId });\n          return false;\n        }\n\n        if (data?.error === "BUSINESS_PAYMENT_METHOD_REQUIRED" || data?.action === "connect_business_billing") {\n          nmToast.error(data?.message || "Connect business billing before launch.");\n          router.push("/business/my-business?billing=required&returnTo=/business/my-business/ad-ideas");\n          return false;\n        }\n\n        nmToast.error(data?.message || data?.error || "Campaign is not ready to launch.");\n        return false;\n      }\n\n      setIdeas((prev) =>\n        prev.map((idea) =>\n          idea.id === adIdeaId ? { ...idea, status: "approved" } : idea,\n        ),\n      );\n      setSelectedIdea((prev) =>\n        prev?.id === adIdeaId ? { ...prev, status: "approved" } : prev,\n      );\n\n      nmToast.success(data?.alreadyLive ? "Campaign is already live." : "Campaign approved and launched on Meta ✅");\n      router.push("/business/manage-campaigns");\n      return true;\n    } catch (error) {\n      console.error("[ad-ideas] launch failed", error);\n      nmToast.error("Could not launch this campaign.");\n      return false;\n    }\n  };\n\n  return (`,
    "replace approve-then-upload with launch boundary",
  );

  s = replaceOnce(
    s,
    '                  : "Required only when approving paid affiliate ad activity. Starts at $49 AUD/month."}',
    '                  : "A real paid campaign is waiting. Start the 14-day Growth trial to unlock paid affiliate advertising; $49 AUD/month after the trial."}',
    "Growth requirement copy",
  );
  s = replaceOnce(s, "Start subscription", "Start 14-day Growth trial", "Growth CTA");

  s = replaceRegex(
    s,
    /                            \{\(!billingReady \|\| \(!subscriptionReady && subscriptionRequired\)\) && \([\s\S]*?                            \)\}\n                            <Button\n                              type="button"\n                              className="w-full"\n                              disabled=\{!launchRequirementsReady\}\n                              onClick=\{async \(\) => \{\n                                const ok = await handleStatusChange\(\n                                  idea\.id,\n                                  "approved",\n                                \);\n                                if \(ok\) \{\n                                  await sendToMeta\(idea\.id\);\n                                \}\n                              \}\}\n                            >\n                              Approve\n                            <\/Button>/,
    `                            {!isCampaignReady(idea.id) && (\n                              <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">\n                                {(campaignReadiness(idea.id)?.blockers || []).map(blockerLabel).join(" · ") ||\n                                  (reviewReadinessLoading ? "Checking launch requirements…" : "Campaign setup is not ready yet.")}\n                              </div>\n                            )}\n                            <Button\n                              type="button"\n                              className="w-full"\n                              disabled={reviewReadinessLoading || !isCampaignReady(idea.id)}\n                              onClick={async () => {\n                                await sendToMeta(idea.id);\n                              }}\n                            >\n                              Approve &amp; launch\n                            </Button>`,
    "pending card launch action",
  );

  s = replaceRegex(
    s,
    /                      <button\n                        onClick=\{async \(\) => \{\n                          const ok = await handleStatusChange\(\n                            selectedIdea\.id,\n                            "approved",\n                          \);\n                          if \(ok\) \{\n                            await sendToMeta\(selectedIdea\.id\);\n                          \}\n                        \}\}\n                        className="w-full py-2 rounded-lg bg\[#00C2CB\][\s\S]*?                      >\n                        Approve &amp; Launch\n                      <\/button>/,
    `                      <button\n                        onClick={async () => {\n                          await sendToMeta(selectedIdea.id);\n                        }}\n                        disabled={reviewReadinessLoading || !isCampaignReady(selectedIdea.id)}\n                        className="w-full py-2 rounded-lg bg-[#00C2CB] hover:bg-[#00b0b8] disabled:cursor-not-allowed disabled:opacity-50 text-black font-semibold text-sm shadow-[0_0_20px_rgba(0,194,203,0.35)] transition"\n                      >\n                        Approve &amp; Launch\n                      </button>`,
    "modal launch action",
  );

  write(path, s);
}

// ---------------------------------------------------------------------------
// Legacy Meta route: defend the launch boundary even if it is called directly.
// ---------------------------------------------------------------------------
{
  const path = "app/api/meta/callback/upload-video/route.ts";
  let s = read(path);

  s = replaceOnce(
    s,
    `import { resolveOfferPaidReadiness } from "@/../utils/offerReadiness";`,
    `import { resolveOfferPaidReadiness } from "@/../utils/offerReadiness";\nimport {\n  getAffiliateCampaignFundingReadiness,\n  getExistingPaidCampaignLaunch,\n  validatePaidCampaignTiming,\n} from "@/../utils/paidCampaignLaunchReadiness";`,
    "Meta route readiness imports",
  );

  s = replaceOnce(
    s,
    `    const fallback_image_url = rest.thumbnail_url;`,
    `    const fallback_image_url = (adIdea as any)?.thumbnail_url || rest.thumbnail_url;`,
    "canonical thumbnail fallback",
  );

  s = replaceOnce(
    s,
    `    const launchApproval = await assertAdIdeaLaunchApproved(supabase as any, {`,
    `    const existingLive = await getExistingPaidCampaignLaunch({\n      supabase,\n      adIdeaId,\n    });\n    if (existingLive?.id) {\n      return NextResponse.json({\n        success: true,\n        alreadyLive: true,\n        campaignId: existingLive.meta_campaign_id || (adIdea as any)?.meta_campaign_id || null,\n        liveAdId: existingLive.id,\n        metaAdId: existingLive.meta_ad_id || null,\n      });\n    }\n\n    if ((adIdea as any)?.meta_campaign_id) {\n      return NextResponse.json(\n        {\n          success: false,\n          error: "CAMPAIGN_PARTIAL_META_STATE",\n          message: "A previous launch created a Meta campaign but did not complete. Automatic retry is blocked to prevent duplication.",\n          metaCampaignId: (adIdea as any).meta_campaign_id,\n        },\n        { status: 409 },\n      );\n    }\n\n    const timingReady = validatePaidCampaignTiming(adIdea as any);\n    if (!timingReady.ok) {\n      return NextResponse.json(\n        { success: false, error: timingReady.error, message: timingReady.message, reason: timingReady.reason },\n        { status: 409 },\n      );\n    }\n\n    const fundingReady = await getAffiliateCampaignFundingReadiness({\n      supabase,\n      affiliateEmail,\n      offerId,\n      adIdea: adIdea as any,\n    });\n    if (!fundingReady.ready) {\n      return NextResponse.json(\n        {\n          success: false,\n          error: "AFFILIATE_CAMPAIGN_FUNDING_REQUIRED",\n          message: \`Affiliate campaign funding is short by $\${fundingReady.deficit.toFixed(2)}.\`,\n          funding: { requiredAmount: fundingReady.requiredAmount, deficit: fundingReady.deficit },\n        },\n        { status: 409 },\n      );\n    }\n\n    const launchApproval = await assertAdIdeaLaunchApproved(supabase as any, {`,
    "Meta idempotency, timing and funding preflight",
  );

  s = replaceRegex(
    s,
    /\n    if \(!connection && !connectionError\) \{[\s\S]*?\n    \}\n\n    if \(connectionError \|\| !connection\) \{/,
    `\n    if (connectionError || !connection) {`,
    "remove unsafe latest Meta connection fallback",
  );

  s = replaceOnce(
    s,
    `    const rawObjective = prefer(rest.objective, adIdea?.objective, "Traffic");`,
    `    const rawObjective = prefer(adIdea?.objective, rest.objective, "Traffic");`,
    "canonical objective",
  );

  s = replaceOnce(
    s,
    `    const payload = {\n      ...rest,\n      adIdeaId,\n      offerId,\n      metaAdAccountId: selectedAdAccountId,\n      metaPageId: selectedPageId,\n    };`,
    `    const payload = {\n      ...(adIdea || {}),\n      adIdeaId,\n      offerId,\n      metaAdAccountId: selectedAdAccountId,\n      metaPageId: selectedPageId,\n    };`,
    "canonical proposal payload",
  );

  s = replaceOnce(
    s,
    `      body.campaign_name,\n      adIdea?.campaign_name,`,
    `      adIdea?.campaign_name,\n      body.campaign_name,`,
    "canonical campaign name",
  );
  s = replaceOnce(
    s,
    `      body.adset_name,\n      adIdea?.adset_name,`,
    `      adIdea?.adset_name,\n      body.adset_name,`,
    "canonical ad set name",
  );
  s = replaceOnce(
    s,
    `      body.ad_name,\n      adIdea?.ad_name,`,
    `      adIdea?.ad_name,\n      body.ad_name,`,
    "canonical ad name",
  );
  s = replaceOnce(
    s,
    `    const budgetType = prefer(body.budget_type, adIdea?.budget_type, "DAILY");`,
    `    const budgetType = prefer(adIdea?.budget_type, body.budget_type, "DAILY");`,
    "canonical budget type",
  );
  s = replaceOnce(
    s,
    `      body.budget_amount,\n      adIdea?.budget_amount,`,
    `      adIdea?.budget_amount,\n      body.budget_amount,`,
    "canonical budget amount",
  );
  s = replaceOnce(
    s,
    `    const startTimeISO = prefer(body.start_time, adIdea?.start_time, null);\n    const endTimeISO = prefer(body.end_time, adIdea?.end_time, null);`,
    `    const startTimeISO = prefer(adIdea?.start_time, body.start_time, null);\n    const endTimeISO = prefer(adIdea?.end_time, body.end_time, null);`,
    "canonical timing",
  );
  s = replaceOnce(
    s,
    `    const headline = prefer(body.headline, adIdea?.headline, "");\n    const caption = prefer(body.caption, adIdea?.caption, "");`,
    `    const headline = prefer(adIdea?.headline, body.headline, "");\n    const caption = prefer(adIdea?.caption, body.caption, "");`,
    "canonical creative text",
  );

  s = replaceOnce(
    s,
    `      adsetParams.daily_budget = budgetAmountStr;\n      adsetParams.start_time = new Date(Date.now() + 60000).toISOString();\n      adsetParams.end_time = new Date(Date.now() + 7 * 86400000).toISOString();`,
    `      adsetParams.daily_budget = budgetAmountStr;\n      adsetParams.start_time =\n        startTimeISO || new Date(Date.now() + 60000).toISOString();\n      adsetParams.end_time =\n        endTimeISO || new Date(Date.now() + 7 * 86400000).toISOString();`,
    "honour proposal timing for daily budgets",
  );

  s = replaceOnce(
    s,
    `    return NextResponse.json({\n      success: true,\n      campaignId: campaignData.id,\n      liveAdId: liveAdRow ? liveAdRow.id : null,\n    });`,
    `    if (!liveAdRow?.id) {\n      return NextResponse.json(\n        {\n          success: false,\n          error: "PARTIAL_META_LAUNCH",\n          message: "Meta campaign creation did not fully complete. The campaign was not marked live and automatic retry is blocked from duplicating the partial Meta campaign.",\n          metaCampaignId: campaignData.id,\n        },\n        { status: 409 },\n      );\n    }\n\n    return NextResponse.json({\n      success: true,\n      campaignId: campaignData.id,\n      liveAdId: liveAdRow.id,\n    });`,
    "prevent false Meta launch success",
  );

  write(path, s);
}

console.log("Proposal-first paid campaign refactor applied successfully.");
