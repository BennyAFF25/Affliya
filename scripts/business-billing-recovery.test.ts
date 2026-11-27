import assert from "node:assert/strict";
import { billingRecoveryMessage, selectBillingRecoveryStage, BILLING_RECOVERY_MAX_AGE_MS } from "../utils/billingRecovery";

const time = Date.parse("2026-10-28T01:00:00Z");
const created = time / 1000;
const age = (hours: number) => selectBillingRecoveryStage(created, time + hours * 3600000);

assert.equal(age(-1), null, "never send before invoice exists");
assert.equal(age(0), "immediate");
assert.equal(age(47.99), "immediate");
assert.equal(age(48), "after_48h");
assert.equal(age(119.99), "after_48h");
assert.equal(age(120), "after_5d");
assert.equal(selectBillingRecoveryStage(created, time + BILLING_RECOVERY_MAX_AGE_MS + 1), null);
assert.equal(selectBillingRecoveryStage(NaN, time), null);
assert.equal(selectBillingRecoveryStage(0, time), null);

for (const stage of ["immediate", "after_48h", "after_5d"] as const) {
  const msg = billingRecoveryMessage(stage, "A$49.00");
  assert.match(msg.subject, /Growth|Nettmark/);
  assert.match(msg.body, /A\$49\.00/);
  assert.doesNotMatch(msg.body, /charged again|will be deleted/i);
}
// E5: card ending and the cancellation consequence on the final notice.
assert.match(billingRecoveryMessage("immediate", "A$49.00", "4242").body, /card ending 4242/);
assert.doesNotMatch(billingRecoveryMessage("immediate", "A$49.00", null).body, /ending/);
assert.match(billingRecoveryMessage("after_5d", "A$49.00").body, /will be cancelled and your account will move to Free/);
console.log("Billing recovery milestone and copy tests passed.");
