import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const signup = readFileSync("app/create-account/page.tsx", "utf8");
const login = readFileSync("app/login/business/page.tsx", "utf8");
const redirect = readFileSync("app/auth-redirect/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20261012052000_provision_auth_signup_profiles.sql", "utf8");
const lockdown = readFileSync("supabase/migrations/20261009224000_lockdown_public_sensitive_tables.sql", "utf8");

// Both business and affiliate signups use the same form and Auth provisioning.
// The browser must not perform upserts of id/email/role, or attempt to access
// pre-signup financial records, because UPDATE grants are column-scoped.
const signupRoute = readFileSync("app/api/auth/signup/route.ts", "utf8");
assert.match(signup, /fetch\("\/api\/auth\/signup"/);
assert.match(signupRoute, /createSignupHandler/);
assert.match(readFileSync("utils/auth/signupHandler.ts", "utf8"), /supabase\.auth\.signUp\(/);
assert.match(signup, /supabase\.auth\.setSession\(data.session\)/);
assert.match(signup, /data: \{ role, username: trimmedUsername,/);
assert.doesNotMatch(signup, /\.from\(['"]profiles['"]\)\s*\.upsert\(/);
assert.doesNotMatch(signup, /pre_signup_revenue['"]\)/);
assert.match(signup, /\.from\('profiles'\)\s*\.select\('role'\)/);
assert.match(signup, /if \(!data\?\.session\)/);
assert.match(signup, /signupInFlight\.current/);
assert.match(signup, /if \(signupInFlight\.current\) return/);
assert.match(signup, /signupInFlight\.current = false/);
assert.match(signup, /router\.replace\(onboardingPath\)/);

// The business login and email-confirmed redirect must stay read-only.
assert.match(login, /getAccountRole/);
assert.doesNotMatch(login, /\.from\("profiles"\)\s*\.upsert\(/);
assert.doesNotMatch(redirect, /\.from\("profiles"\)\s*\.insert\(/);
assert.match(readFileSync("utils/affiliate/accountRole.ts", "utf8"), /\.from\(['"]profiles['"]\)\s*\.select\(['"]role['"]\)/);

// The migration creates profiles exactly once on auth.users inserts, rather
// than widening profile role, email, and Stripe-field update permissions.
assert.match(migration, /SECURITY DEFINER/);
assert.match(migration, /SET search_path = ''/);
assert.match(migration, /CREATE TRIGGER nettmark_provision_profile_on_signup/);
assert.match(migration, /AFTER INSERT ON auth\.users/);
assert.match(migration, /requested_role NOT IN \('business', 'affiliate'\)/);
assert.match(migration, /ON CONFLICT \(id\) DO NOTHING/);
assert.match(migration, /CASE WHEN requested_role = 'affiliate'/);
assert.match(migration, /UPDATE public\.business_profiles/);
assert.match(migration, /AND NOT EXISTS \(SELECT 1 FROM public\.profiles/);
assert.match(migration, /REVOKE ALL ON FUNCTION/);
assert.doesNotMatch(migration, /GRANT UPDATE.*profiles/);
assert.match(lockdown, /grant update \(username, onboarding_completed, terms_accepted, terms_accepted_at, payout_threshold_cents\)/);

console.log("business + affiliate signup profile provisioning regression checks passed");
