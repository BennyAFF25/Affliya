import * as assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const sql = (query: string) => execFileSync("psql", ["-XAt", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" }).trim();
const id = "22222222-2222-4222-8222-222222222222";
const id2 = "33333333-3333-4333-8333-333333333333";
function insert(businessId: string, suffix: string) {
  sql("INSERT INTO business_profiles VALUES ('" + businessId + "'); INSERT INTO meta_start_trial_delivery(business_id,stripe_subscription_id,stripe_event_id,event_id,event_time,payload) VALUES ('" + businessId + "','sub_" + suffix + "','evt_" + suffix + "','event_" + suffix + "',extract(epoch from now())::bigint,'{\"event_name\":\"StartTrial\",\"event_id\":\"event_" + suffix + "\"}')");
}
async function run() {
  insert(id, "one");
  assert.equal(sql("SELECT has_function_privilege('authenticated','claim_meta_start_trial_delivery(uuid)','EXECUTE')"), "f");
  assert.equal(sql("SELECT has_table_privilege('authenticated','meta_start_trial_delivery','SELECT')"), "f");
  const results = await Promise.all([1,2,3].map(() => exec("psql", ["-XAt", "-v", "ON_ERROR_STOP=1", "-c", "BEGIN; SET LOCAL ROLE service_role; SELECT count(*) FROM claim_meta_start_trial_delivery(); SELECT pg_sleep(0.2); COMMIT"])));
  assert.equal(results.map(result => result.stdout.split("\n").filter(value => value === "1").length).reduce((a,b) => a+b, 0), 1);
  const oldLease = sql("SELECT lease_token FROM meta_start_trial_delivery WHERE business_id='" + id + "'");
  sql("UPDATE meta_start_trial_delivery SET lease_until=now()-interval '1 minute'");
  assert.equal(sql("SELECT count(*) FROM claim_meta_start_trial_delivery()"), "1");
  const newLease = sql("SELECT lease_token FROM meta_start_trial_delivery WHERE business_id='" + id + "'");
  assert.notEqual(oldLease, newLease);
  assert.equal(sql("WITH changed AS (UPDATE meta_start_trial_delivery SET status='sent' WHERE lease_token='" + oldLease + "' RETURNING 1) SELECT count(*) FROM changed"), "0");
  assert.equal(sql("WITH changed AS (UPDATE meta_start_trial_delivery SET status='sent' WHERE lease_token='" + newLease + "' RETURNING 1) SELECT count(*) FROM changed"), "1");
  assert.equal(sql("SELECT count(*) FROM claim_meta_start_trial_delivery()"), "0");
  assert.throws(() => execFileSync("psql", ["-XAt", "-v", "ON_ERROR_STOP=1", "-c", "INSERT INTO meta_start_trial_delivery SELECT * FROM meta_start_trial_delivery"], { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }));
  assert.equal(sql("SELECT count(*) FROM meta_start_trial_delivery"), "1");
  insert(id2, "two");
  sql("UPDATE meta_start_trial_delivery SET first_attempt_at=now()-interval '25 hours' WHERE business_id='" + id2 + "'");
  assert.equal(sql("SELECT count(*) FROM claim_meta_start_trial_delivery()"), "0");
  assert.equal(sql("SELECT status FROM meta_start_trial_delivery WHERE business_id='" + id2 + "'"), "expired");
  console.log("Meta StartTrial SQL uniqueness, RLS, concurrent leases, stale acknowledgements and expiry passed");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
