const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { chromium } = require("playwright");
const origin = "http://127.0.0.1:3100";
const userId = "11111111-1111-4111-8111-111111111110";
const offerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const user = { id: userId, email: "business@example.test", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
const expiresAt = Math.floor(Date.now() / 1000) + 86400;
const token = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." +
  Buffer.from(JSON.stringify({ sub: userId, email: user.email, aud: user.aud, role: user.role, exp: expiresAt, app_metadata: user.app_metadata, user_metadata: {} })).toString("base64url") + ".fixture-signature";
const session = { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 86400, expires_at: expiresAt, user };

const contextData = {
  business_onboarding_funnel: "trial_first_v1_100", treatment: true, offerId,
  participationMode: "open", trialEligible: true, trialDays: 14, checkoutEnabled: true, billingError: null,
  price: { amount: 7200, currency: "AUD", interval: "month", intervalCount: 1, formatted: "AUD 72.00", taxNotice: "Your final total is shown in checkout." },
};
let variant = { ...contextData }, writes = [], events = [], failCheckout = false, failComplete = false;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://policy-fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "business-trial-first-test-key" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "", browser, activePage;
server.stdout.on("data", chunk => { serverLog += chunk; });
server.stderr.on("data", chunk => { serverLog += chunk; });
async function ready() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try { if ((await fetch(origin + "/legal/privacy/cookies", { signal: AbortSignal.timeout(4000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Next.js test server did not become ready");
}
async function main() {
  await ready();
  browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  for (const viewport of [{ width: 390, height: 650 }, { width: 320, height: 568 }, { width: 1280, height: 800 }]) {
    const browserContext = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
    await browserContext.addCookies([{ name: "sb-policy-fixture-auth-token", value: encodeURIComponent(JSON.stringify(session)), url: origin }]);
    await browserContext.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: "sb-policy-fixture-auth-token", value: JSON.stringify(session) });
    const page = await browserContext.newPage(); activePage = page; page.setDefaultTimeout(30000);
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.hostname === "policy-fixture.supabase.co") {
        if (url.pathname === "/auth/v1/user") return json(user);
        if (url.pathname === "/auth/v1/token") return json(session);
        if (request.method() !== "GET") {
          writes.push(url.pathname);
          if (url.pathname.endsWith("/offers")) return json(null, 201);
          return json({ message: "Unexpected persistence" }, 400);
        }
        const table = url.pathname.split("/").pop();
        const rows = table === "business_profiles" ? [{ id: userId, business_email: user.email, business_name: "Test business" }] :
          table === "profiles" ? [{ id: userId, email: user.email, role: "business", onboarding_completed: true }] : [];
        return json(String(request.headers().accept || "").includes("vnd.pgrst.object") ? rows[0] || null : rows);
      }
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/business-subscription/trial-eligibility") return json(variant);
      if (url.pathname === "/api/product-events") { events.push(request.postDataJSON()); return json({ ok: true }); }
      if (url.pathname === "/api/business-subscription/create-checkout-session") {
        writes.push(request.postDataJSON());
        return failCheckout ? json({ error: "A free trial is no longer available. No paid checkout was created." }, 409) : json({ url: "https://checkout.stripe.test/session" });
      }
      if (url.pathname === "/api/business-subscription/choose-free") { writes.push("confirmed_free"); return json({ ok: true }); }
      if (url.pathname === "/api/business-subscription/get-session") return json({ error: "Checkout not found" }, 403);
      if (url.pathname === "/api/profile/onboarding-complete") { writes.push("complete"); return failComplete ? json({ error: "Your offer is saved. Please retry to finish setup." }, 503) : json({ ok: true, treatment: true, offerId }); }
      if (url.pathname.startsWith("/business/my-business")) return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Business dashboard handoff</p>" });
      if (url.pathname.startsWith("/api/")) return json({});
      return route.continue();
    });
    variant = { ...contextData }; writes = []; events = [];
    await page.goto(origin + "/business/choose-plan");
    await page.getByRole("heading", { name: "Your offer is live.", exact: true }).waitFor();
    assert.deepEqual(writes, [], "Visits never create trials/customers/charges");
    assert.equal(await page.locator('[data-funnel="trial_first_v1_100"]').count(), 1);
    assert.ok(events.some(e => e.eventType === "plan_choice_viewed" && e.meta.screen === "trial_first"));
    const terms = page.getByTestId("billing-terms");
    assert.match(await terms.textContent(), /AUD 72.00\/month/);
    assert.match(await terms.textContent(), /14-day/);
    assert.match(await terms.textContent(), /Card required/);
    assert.match(await terms.textContent(), /cancel before the trial ends/);
    const growth = page.getByRole("button", { name: "Start my free trial", exact: true });
    const free = page.getByRole("button", { name: "Continue with Free", exact: true });
    assert.equal(await growth.isEnabled(), true); assert.equal(await free.isEnabled(), true);
    await free.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    if (viewport.width === 390) await page.screenshot({ path: "business-trial-first-mobile.png", fullPage: true });
    failCheckout = true;
    await growth.click();
    await page.getByRole("alert").filter({ hasText: "No paid checkout" }).waitFor();
    assert.equal(writes.length, 1); assert.equal(writes[0].requireTrial, true);
    await free.click();
    await page.waitForURL(url => url.pathname === "/business/my-business");
    assert.ok(writes.includes("confirmed_free")); failCheckout = false;

    variant = { ...contextData, price: null, trialEligible: null, billingError: "Pricing could not be verified." }; writes = [];
    await page.goto(origin + "/business/choose-plan");
    await growth.waitFor(); assert.equal(await growth.isEnabled(), false); assert.equal(await free.isEnabled(), true);
    assert.deepEqual(writes, []);
    variant = { ...contextData, treatment: false, business_onboarding_funnel: "plan_choice_v1" };
    await page.goto(origin + "/business/choose-plan");
    await page.getByRole("heading", { name: "Organic", exact: true }).waitFor();
    await page.getByRole("button", { name: "Continue free", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Your offer is live.", exact: true }).count(), 0);

    variant = { ...contextData }; writes = [];
    await page.goto(origin + "/business/choose-plan?subscription=checkout_returned&session_id=another_users_session");
    await page.getByRole("alert").filter({ hasText: "Checkout not found" }).waitFor();
    assert.ok(!writes.includes("confirmed_free"), "A return cannot fabricate Free selection or a trial");

    if (viewport.width === 390) {
      writes = []; failComplete = true;
      await page.goto(origin + "/onboarding/for-business");
      // Exercise the real builder rather than a component harness.
      await page.getByRole("button", { name: "Get started", exact: true }).click();
      await page.getByPlaceholder("Example: Summer skincare bundle").fill("Test product");
      await page.getByPlaceholder("https://yourstore.com/product").fill("https://example.test/product");
      await page.getByPlaceholder("A quick description of what affiliates will promote.").fill("A test product with clear benefits.");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByPlaceholder("100.00").fill("100");
      await page.getByPlaceholder("20", { exact: true }).fill("20");
      await page.getByRole("button", { name: "See my offer", exact: true }).click();
      await page.getByRole("button", { name: "Publish offer", exact: true }).click();
      await page.getByText("Your offer is saved. Please retry to finish setup.", { exact: true }).waitFor();
      assert.equal(writes.filter(x => x === "/rest/v1/offers").length, 1);
      assert.ok(events.some(e => e.eventType === "offer_create_viewed" && e.meta.source === "business_onboarding"));
      assert.ok(events.some(e => e.eventType === "offer_publish_clicked"));
      failComplete = false;
      await page.getByRole("button", { name: "Finish setup", exact: true }).click();
      await page.getByRole("heading", { name: "Your offer is live.", exact: true }).waitFor();
      assert.equal(writes.filter(x => x === "/rest/v1/offers").length, 1, "Retry completion without duplicate persisted offers");
    }
    await browserContext.close();
  }
  console.log("Business trial-first mobile/desktop continuation checks passed");
}
main().catch(async error => {
  console.error(error);
  if (activePage) console.error((await activePage.locator("body").innerText().catch(() => "")).slice(-4000));
  process.exitCode = 1;
}).finally(async () => {
  writeFileSync("business-trial-first-server.log", serverLog);
  if (browser) await browser.close();
  server.kill("SIGTERM");
});
