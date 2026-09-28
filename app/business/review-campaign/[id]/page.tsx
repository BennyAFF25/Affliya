import { redirect } from "next/navigation";

export default async function LegacyCampaignReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/business/my-business/ad-ideas/${encodeURIComponent(String(id || ""))}`);
}
