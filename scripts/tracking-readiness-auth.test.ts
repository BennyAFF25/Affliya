import assert from "node:assert/strict";
import { handleTrackingReadiness, type ReadinessDeps } from "../utils/tracking/readinessRequest";

const offers = [
  { id: "own-offer", business_email: "Owner@Example.test" },
  { id: "other-offer", business_email: "rival@example.test" },
];
const admin = { from: () => { throw new Error("readiness checks are stubbed"); } } as unknown as ReadinessDeps["admin"];
const lookupOffers = async (ids: string[]) => offers.filter(o => ids.includes(o.id));
const checked: string[] = [];
const deps = (user: { id: string; email: string } | null): ReadinessDeps => ({
  getUser: async () => user, admin, lookupOffers,
  checkDisplay: async (_c, id) => { checked.push(`display:${id}`); return true; },
  checkApproval: async (_c, id) => { checked.push(`approval:${id}`); return { ok: true }; },
});
const owner = { id: "u1", email: "owner@example.test" };

(async () => {
  let r = await handleTrackingReadiness({ offerIds: ["own-offer"] }, deps(null));
  assert.equal(r.status, 401, "signed out");
  r = await handleTrackingReadiness({ offerIds: ["other-offer"] }, deps(owner));
  assert.equal(r.status, 403, "another business's offer");
  r = await handleTrackingReadiness({ offerIds: ["own-offer", "other-offer"] }, deps(owner));
  assert.equal(r.status, 403, "mixed list refused");
  r = await handleTrackingReadiness({ offerIds: ["missing-offer"] }, deps(owner));
  assert.equal(r.status, 403, "unknown offer refused");
  assert.equal(checked.length, 0, "no readiness checks run before ownership passes");
  r = await handleTrackingReadiness({ offerIds: ["own-offer"] }, deps(owner));
  assert.deepEqual(r, { status: 200, body: { verifiedOfferIds: ["own-offer"] } }, "owner approval check");
  r = await handleTrackingReadiness({ offerIds: ["own-offer"], purpose: "display" }, deps(owner));
  assert.deepEqual(r, { status: 200, body: { verifiedOfferIds: ["own-offer"] } }, "owner display check");
  assert.deepEqual(checked, ["approval:own-offer", "display:own-offer"]);
  r = await handleTrackingReadiness({ offerIds: [] }, deps(owner));
  assert.equal(r.status, 200);
  console.log("tracking-readiness auth: 401/403/200 passed");
})().catch(e => { console.error(e); process.exit(1); });
