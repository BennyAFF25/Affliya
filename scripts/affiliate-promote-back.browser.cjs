const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { chromium } = require("playwright");
const origin = "http://127.0.0.1:3100";
const userId = "33333333-3333-4333-8333-333333333333";
const offerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const user = { id: userId, email: "affiliate@example.test", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
const expiresAt = Math.floor(Date.now() / 1000) + 86400;
const token = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." +
  Buffer.from(JSON.stringify({ sub: userId, email: user.email, aud: user.aud, role: user.role, exp: expiresAt, app_metadata: user.app_metadata, user_metadata: {} })).toString("base64url") + ".fixture-signature";
const session = { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 86400, expires_at: expiresAt, user };
const row = { id: offerId, title: "Test brand", description: "A sample brand offer", business_email: "brand@example.test", website: "https://brand.example.test", commission: 20, participation_mode: "open", status: "active", type: "one-time", currency: "USD", logo_url: null, meta_page_id: null, meta_ad_account_id: null, meta_pixel_id: null };
const dto = { description: row.description, logoUrl: null, commission: 20, commissionValue: null, currency: "USD", type: "one-time", participationMode: "open", requestStatus: "approved", readyOrganicCount: 0 };
const offers = [{ ...dto, id: offerId, title: "Test brand" }, { ...dto, id: otherId, title: "Another brand" }];
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://policy-fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "promote-back-test-key" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "", browser, activePage, writes = [];
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
async function visibleInViewport(link, page) {
  const box = await link.boundingBox(), viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 64 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, "Back link is visible below the fixed app header");
}
async function main() {
  await ready();
  browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  for (const viewport of [{ width: 390, height: 650 }, { width: 320, height: 568 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
    // Authenticated browser fixture; no production credentials or auth configuration changes.
    await context.addCookies([{ name: "sb-policy-fixture-auth-token", value: encodeURIComponent(JSON.stringify(session)), url: origin }]);
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: "sb-policy-fixture-auth-token", value: JSON.stringify(session) });
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(30000);
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.hostname === "policy-fixture.supabase.co") {
        if (url.pathname === "/auth/v1/user") return json(user);
        if (url.pathname === "/auth/v1/token") return json(session);
        if (request.method() !== "GET") { writes.push(url.pathname); return json({ message: "Unexpected persistence write" }, 400); }
        const table = url.pathname.split("/").pop();
        const rows = table === "offers" ? [row] : table === "profiles" ? [{ id: userId, role: "affiliate", email: user.email, terms_accepted: true, onboarding_completed: true }] : table === "affiliate_requests" ? [{ status: "approved" }] : [];
        const single = String(request.headers().accept || "").includes("vnd.pgrst.object");
        return json(single ? rows[0] || null : rows);
      }
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/onboarding/affiliate-offers") return json({ offers, userId, termsAccepted: true });
      if (url.pathname.endsWith("/brand-content")) return json({ ok: true, assets: [] });
      if (url.pathname.endsWith("/generate-promotion")) return json({ available: false });
      if (url.pathname.endsWith("/start") || url.pathname.endsWith("/ready-organic-promotion") || url.pathname.includes("/launch") || url.pathname.includes("/stripe/")) {
        writes.push(url.pathname); return json({ message: "Unexpected promotion/financial action" }, 400);
      }
      if (url.pathname.startsWith("/api/")) return json({}, url.pathname === "/api/chatbase/identify" ? 401 : 200);
      return route.continue();
    });
    writes = [];
    for (const mode of ["organic", "ad"]) {
      const editor = "/affiliate/dashboard/promote/" + offerId + "?mode=" + mode + "&source=onboarding";
      await page.goto(origin + editor);
      // Render the actual protected editor, not a component harness or intercepted destination.
      await page.getByRole("heading", { name: mode === "organic" ? "Submit Organic Promotion" : "Create New Ad Campaign", exact: true }).waitFor();
      const back = page.getByRole("link", { name: "Back to offers", exact: true });
      await back.waitFor(); await visibleInViewport(back, page);
      const expected = "/onboarding/for-partners" + (mode === "ad" ? "?mode=ad" : "");
      assert.equal(await back.getAttribute("href"), expected);
      await page.reload();
      await back.waitFor(); await visibleInViewport(back, page);
      assert.equal(await back.getAttribute("href"), expected, "Refresh retains the correct return destination");
      if (viewport.width === 390 && mode === "organic") await page.screenshot({ path: "affiliate-promote-back-mobile.png" });
      await back.click();
      await page.waitForURL(url => url.pathname === "/onboarding/for-partners" && !url.searchParams.has("offerId"));
      await page.getByRole("heading", { name: "Who would you like to promote?", exact: true }).waitFor();
      await page.getByRole("button", { name: /Another brand/ }).click();
      await page.getByRole("region", { name: "Selected brand", exact: true }).getByRole("heading", { name: "Another brand", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: mode === "ad" ? /^Paid campaign/ : /^Organic post/ }).getAttribute("aria-pressed"), "true");
      assert.deepEqual(writes, [], "Returning and choosing a different brand must not submit or fund anything");
    }
    await page.goto(origin + "/affiliate/dashboard/promote/" + offerId + "?mode=ad&source=onboarding");
    const back = page.getByRole("link", { name: "Back to offers", exact: true });
    await back.waitFor();
    await page.getByRole("button", { name: "Submit Organic", exact: true }).click();
    assert.equal(await back.getAttribute("href"), "/onboarding/for-partners", "Return uses the currently selected promotion mode");

    await page.goto(origin + "/affiliate/dashboard/promote/" + offerId + "?mode=organic");
    await back.waitFor(); await visibleInViewport(back, page);
    assert.equal(await back.getAttribute("href"), "/affiliate/marketplace", "Regular entries return to marketplace");
    await back.click(); await page.waitForURL(url => url.pathname === "/affiliate/marketplace");
    assert.deepEqual(writes, []);
    await context.close();
  }
  await browser.close(); browser = null;
  console.log("Actual organic/paid Promote return, refresh, direct entry, mode switch, alternate offer and mobile/desktop browser checks passed");
}
main().catch(async error => {
  console.error(error);
  if (activePage && !activePage.isClosed()) {
    console.error("Fixture page URL:", activePage.url());
    try { console.error("Fixture headings/links:", await activePage.locator("h1,h2,a").allTextContents()); } catch {}
  }
  writeFileSync("affiliate-promote-back-server.log", serverLog);
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); server.kill("SIGTERM"); });
