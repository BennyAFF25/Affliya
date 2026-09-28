import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Patch failed: ${label}`);
  return content.replace(search, replacement);
}
function replaceRegex(content, regex, replacement, label) {
  if (!regex.test(content)) throw new Error(`Patch failed: ${label}`);
  return content.replace(regex, replacement);
}

// Affiliate proposal submit: return proposal ID, notify the business, and land
// the affiliate on campaign management where the pending state is visible.
{
  const path = "app/affiliate/dashboard/promote/[offerId]/page.tsx";
  let s = read(path);
  s = replaceOnce(
    s,
    `      const { error: insertErr } = await (\n        supabase.from("ad_ideas") as any\n      ).insert([insertPayload as any]);\n      if (insertErr) throw insertErr;`,
    `      const { data: insertedIdeas, error: insertErr } = await (\n        supabase.from("ad_ideas") as any\n      )\n        .insert([insertPayload as any])\n        .select("id");\n      if (insertErr) throw insertErr;\n\n      const createdIdeaId = insertedIdeas?.[0]?.id || null;\n      if (createdIdeaId) {\n        void fetch("/api/affiliate/ad-ideas/notify-submitted", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ adIdeaId: createdIdeaId }),\n        }).catch((error) =>\n          console.warn("[proposal-submitted] business notification failed", error),\n        );\n      }`,
    "proposal insert notification",
  );
  s = replaceOnce(
    s,
    `      router.push("/affiliate/dashboard"); // back to dashboard after submit`,
    `      router.push("/affiliate/dashboard/manage-campaigns");`,
    "proposal redirect",
  );
  write(path, s);
}

// Business modal must use the same authenticated launch boundary as the card.
{
  const path = "app/business/my-business/ad-ideas/page.tsx";
  let s = read(path);
  s = replaceRegex(
    s,
    /                      <button\n                        onClick=\{async \(\) => \{\n                          const ok = await handleStatusChange\([\s\S]*?                        Approve &amp; Launch\n                      <\/button>/,
    `                      <button\n                        onClick={async () => {\n                          await sendToMeta(selectedIdea.id);\n                        }}\n                        disabled={reviewReadinessLoading || !isCampaignReady(selectedIdea.id)}\n                        className="w-full py-2 rounded-lg bg-[#00C2CB] hover:bg-[#00b0b8] disabled:cursor-not-allowed disabled:opacity-50 text-black font-semibold text-sm shadow-[0_0_20px_rgba(0,194,203,0.35)] transition"\n                      >\n                        Approve &amp; Launch\n                      </button>`,
    "modal launch boundary",
  );
  write(path, s);
}

// Affiliate campaign management: show pending proposals and only prompt wallet
// funding once the business has actually enabled paid promotion / Growth.
{
  const path = "app/affiliate/dashboard/manage-campaigns/page.tsx";
  let s = read(path);

  s = replaceOnce(
    s,
    `type LiveCampaignRow = {\n  id: string;\n  type?: string | null;\n  offer_id?: string | null;\n  business_email?: string | null;\n  affiliate_email?: string | null;\n  media_url?: string | null;\n  caption?: string | null;\n  platform?: string | null;\n  created_from?: string | null;\n  status?: string | null;\n  created_at?: string | null;\n};`,
    `type LiveCampaignRow = {\n  id: string;\n  type?: string | null;\n  offer_id?: string | null;\n  business_email?: string | null;\n  affiliate_email?: string | null;\n  media_url?: string | null;\n  caption?: string | null;\n  platform?: string | null;\n  created_from?: string | null;\n  status?: string | null;\n  created_at?: string | null;\n};\n\ntype PendingPaidProposal = {\n  id: string;\n  offerId: string;\n  offerTitle: string;\n  businessEmail: string;\n  campaignName?: string | null;\n  objective?: string | null;\n  createdAt?: string | null;\n  state: "waiting_for_business" | "funding_required" | "funded_waiting_for_business";\n  growthReady: boolean;\n  funding: {\n    ready: boolean;\n    requiredAmount: number;\n    deficit: number;\n  };\n};`,
    "pending proposal type",
  );

  s = replaceOnce(
    s,
    `  const [paidMeta, setPaidMeta] = useState<LiveAdRow[]>([]);\n  const [organic, setOrganic] = useState<LiveCampaignRow[]>([]);`,
    `  const [paidMeta, setPaidMeta] = useState<LiveAdRow[]>([]);\n  const [organic, setOrganic] = useState<LiveCampaignRow[]>([]);\n  const [pendingPaid, setPendingPaid] = useState<PendingPaidProposal[]>([]);`,
    "pending proposal state",
  );

  s = replaceOnce(
    s,
    `      if (!email) {\n        setPaidMeta([]);\n        setOrganic([]);\n        setError("No authenticated user email found.");\n        return;\n      }`,
    `      if (!email) {\n        setPaidMeta([]);\n        setOrganic([]);\n        setPendingPaid([]);\n        setError("No authenticated user email found.");\n        return;\n      }\n\n      try {\n        const pendingRes = await fetch("/api/affiliate/pending-paid-proposals", {\n          cache: "no-store",\n        });\n        const pendingJson = await pendingRes.json().catch(() => null);\n        if (!pendingRes.ok || !pendingJson?.success) {\n          throw new Error(pendingJson?.message || pendingJson?.error || "Failed to load pending proposals");\n        }\n        setPendingPaid((pendingJson.proposals || []) as PendingPaidProposal[]);\n      } catch (pendingError) {\n        console.warn("[affiliate/manage-campaigns] pending proposals unavailable", pendingError);\n        setPendingPaid([]);\n      }`,
    "fetch pending proposals",
  );

  s = replaceOnce(
    s,
    `  const organicCount = organic.length;`,
    `  const organicCount = organic.length;\n  const pendingCount = pendingPaid.length;`,
    "pending count",
  );

  s = replaceOnce(
    s,
    `<section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">`,
    `<section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">`,
    "stats grid",
  );

  s = replaceOnce(
    s,
    `          <StatCard label="Live campaigns" value={activeCount.toString()} icon={<Activity className="h-4 w-4" />} tone="primary" />`,
    `          <StatCard label="Pending proposals" value={pendingCount.toString()} icon={<Megaphone className="h-4 w-4" />} tone="primary" />\n          <StatCard label="Live campaigns" value={activeCount.toString()} icon={<Activity className="h-4 w-4" />} tone="primary" />`,
    "pending stat",
  );

  s = replaceOnce(
    s,
    `        {/* Active */}\n        <Card className="mb-6 p-5 md:p-6" variant="elevated">`,
    `        {/* Pending paid proposals */}\n        <Card className="mb-6 p-5 md:p-6" variant="elevated">\n          <SectionHeader\n            title="Pending paid proposals"\n            description="Real campaigns you've submitted that have not launched yet."\n            actions={<Badge variant="primary">{pendingCount} pending</Badge>}\n          />\n          <div className="mt-5">\n            {loading ? (\n              <LoadingSkeleton lines={2} />\n            ) : pendingPaid.length === 0 ? (\n              <EmptyState\n                title="No pending paid proposals"\n                description="Submit a paid campaign proposal from an offer and it will wait here until launch."\n                className="py-7"\n              />\n            ) : (\n              <div className="space-y-3">\n                {pendingPaid.map((proposal) => (\n                  <PendingProposalRow key={proposal.id} proposal={proposal} />\n                ))}\n              </div>\n            )}\n          </div>\n        </Card>\n\n        {/* Active */}\n        <Card className="mb-6 p-5 md:p-6" variant="elevated">`,
    "pending proposals card",
  );

  s = replaceOnce(
    s,
    `function CampaignRow({`,
    `function PendingProposalRow({ proposal }: { proposal: PendingPaidProposal }) {\n  const fundingRequired = proposal.state === "funding_required";\n  const funded = proposal.state === "funded_waiting_for_business";\n  const title = proposal.campaignName || proposal.offerTitle;\n\n  const statusLabel = fundingRequired\n    ? "FUNDING REQUIRED"\n    : funded\n      ? "FUNDED"\n      : "WAITING FOR BUSINESS";\n\n  const description = fundingRequired\n    ? \`The business has enabled paid promotion. Add $\${proposal.funding.deficit.toFixed(2)} to prepare this campaign for launch.\`\n    : funded\n      ? "Campaign funding is ready. Waiting for the business to finish setup and approve the campaign."\n      : "Proposal sent. No deposit is required while the business decides whether to enable paid promotion.";\n\n  return (\n    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-5">\n      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">\n        <div className="min-w-0">\n          <div className="flex flex-wrap items-center gap-3">\n            <div className="text-lg font-semibold">{title}</div>\n            <Badge variant={fundingRequired ? "warning" : funded ? "success" : "muted"}>\n              {statusLabel}\n            </Badge>\n          </div>\n          <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">\n            {description}\n          </p>\n          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">\n            <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">\n              {proposal.offerTitle}\n            </span>\n            <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">\n              Required at launch: $\${proposal.funding.requiredAmount.toFixed(2)}\n            </span>\n            {proposal.createdAt ? (\n              <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">\n                Submitted {shortDate(proposal.createdAt)}\n              </span>\n            ) : null}\n          </div>\n        </div>\n        {fundingRequired ? (\n          <Button href="/affiliate/wallet" className="rounded-full">\n            Top up wallet\n          </Button>\n        ) : null}\n      </div>\n    </div>\n  );\n}\n\nfunction CampaignRow({`,
    "pending proposal row",
  );

  write(path, s);
}

console.log("Proposal flow follow-up patch applied successfully.");
