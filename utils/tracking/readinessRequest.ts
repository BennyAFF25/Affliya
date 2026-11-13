import type { QueryClient } from "../approvals/enforcement";

export type ReadinessDeps = {
  /** Signed-in caller from the session cookie, or null. */
  getUser: () => Promise<{ id: string; email?: string | null } | null>;
  /** Service-role client (server only). */
  admin: QueryClient;
  /** Owner email for each offer id (service-role lookup). */
  lookupOffers: (offerIds: string[]) => Promise<{ id: string; business_email?: string | null }[]>;
  checkDisplay: (client: QueryClient, offerId: string) => Promise<boolean>;
  checkApproval: (client: QueryClient, offerId: string) => Promise<{ ok: boolean }>;
};

export type ReadinessResult = { status: number; body: Record<string, unknown> };

const norm = (value: unknown) => String(value || "").trim().toLowerCase();

/**
 * Tracking readiness for the signed-in business's own offers.
 * No admin role exists in profiles (only affiliate/business), so there is no admin bypass.
 */
export async function handleTrackingReadiness(body: unknown, deps: ReadinessDeps): Promise<ReadinessResult> {
  const user = await deps.getUser();
  if (!user?.id || !user.email) return { status: 401, body: { error: "unauthorized" } };

  const input = body as { offerIds?: unknown; purpose?: unknown } | null;
  const offerIds: string[] = Array.isArray(input?.offerIds)
    ? [...new Set(input!.offerIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))]
    : [];
  if (!offerIds.length) return { status: 200, body: { verifiedOfferIds: [] } };
  if (offerIds.length > 200) return { status: 400, body: { error: "too_many_offers" } };

  const offers = await deps.lookupOffers(offerIds);
  const ownerById = new Map<string, string>(offers.map(o => [String(o.id), norm(o.business_email)]));
  const email = norm(user.email);
  if (offerIds.some(id => ownerById.get(id) !== email)) return { status: 403, body: { error: "forbidden" } };

  const verifiedOfferIds: string[] = [];
  for (const offerId of offerIds) {
    if (input?.purpose === "display") {
      if (await deps.checkDisplay(deps.admin, offerId)) verifiedOfferIds.push(offerId);
      continue;
    }
    if ((await deps.checkApproval(deps.admin, offerId)).ok) verifiedOfferIds.push(offerId);
  }
  return { status: 200, body: { verifiedOfferIds } };
}
