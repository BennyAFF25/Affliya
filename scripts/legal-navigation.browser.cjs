const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { chromium } = require("playwright");

const origin = "http://127.0.0.1:3100";
const offerId = "11111111-1111-4111-8111-111111111111";
const userId = "33333333-3333-4333-8333-333333333333";
const setup = "/onboarding/for-partners?offerId=" + offerId + "&mode=ad";
const termsText = "I have read and agree to the Terms of Service and Privacy Policy";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://policy-fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "policy-navigation-test-key" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", chunk => { serverLog += chunk; });
server.stderr.on("data", chunk => { serverLog += chunk; });
let browser;
let writes = [];
let failAcceptance = true;

async function ready() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin + "/legal/privacy/cookies", { signal: AbortSignal.timeout(4000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Next.js test server did not become ready");
}
async function main() {
  await ready();
  browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 650 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "policy-fixture.supabase.co") {
      if (url.pathname === "/rest/v1/profiles" && request.method() === "PATCH") {
        writes.push({ body: request.postDataJSON(), id: url.searchParams.get("id") });
        await route.fulfill({ status: failAcceptance ? 500 : 204, contentType: "application/json", body: failAcceptance ? JSON.stringify({ message: "test save failed" }) : "" });
      } else { await route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
      return;
    }
    if (url.origin !== origin) { await route.abort(); return; }
    if (url.pathname === "/api/onboarding/affiliate-offers") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        offers: [{ id: offerId, title: "Test brand", description: "A sample offer", logoUrl: null, commission: 20, commissionValue: null, currency: "USD", type: "one-time", participationMode: "open", requestStatus: null, readyOrganicCount: 0 }],
        termsAccepted: false, userId,
      }) }); return;
    }
    if (url.pathname.startsWith("/api/")) {
      await route.fulfill({ status: url.pathname === "/api/chatbase/identify" ? 401 : 200, contentType: "application/json", body: "{}" }); return;
    }
    await route.continue();
  });
  await page.goto(origin + setup);
  const initial = page.getByRole("dialog", { name: "Accept terms to continue", exact: true });
  await initial.waitFor({ state: "visible" });
  assert.equal(await initial.getByRole("button", { name: "Accept & Continue", exact: true }).isEnabled(), false);
  await initial.getByRole("checkbox", { name: termsText, exact: true }).check();
  for (const label of ["Terms of Service", "Privacy Policy", "Cookie Policy"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const reader = page.getByRole("dialog", { name: label, exact: true });
    await reader.waitFor({ state: "visible" });
    assert.equal(page.url(), origin + setup);
    assert.equal(writes.length, 0, "Reading must not record acceptance");
    const back = reader.getByRole("button", { name: "Back to terms", exact: true });
    assert.ok(await back.isVisible());
    const backBox = await back.boundingBox();
    assert.ok(backBox && backBox.y >= 0 && backBox.y + backBox.height <= 650, "Reader exit fits the mobile viewport");
    if (label === "Cookie Policy") await page.screenshot({ path: "legal-policy-mobile.png", fullPage: true });
    await back.click();
    await initial.waitFor({ state: "visible" });
    assert.equal(await initial.getByRole("checkbox", { name: termsText, exact: true }).isChecked(), true);
  }
  await page.getByRole("button", { name: "Cookie Policy", exact: true }).click();
  await page.keyboard.press("Escape");
  await initial.waitFor({ state: "visible" });
  assert.equal(await initial.getByRole("checkbox", { name: termsText, exact: true }).isChecked(), true);
  await initial.getByRole("button", { name: "Accept & Continue", exact: true }).click();
  await initial.getByRole("alert").waitFor({ state: "visible" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].id, "eq." + userId);
  assert.equal(writes[0].body.terms_accepted, true);
  assert.ok(!Number.isNaN(Date.parse(writes[0].body.terms_accepted_at)));
  assert.equal(page.url(), origin + setup);
  failAcceptance = false;
  await initial.getByRole("button", { name: "Accept & Continue", exact: true }).click();
  await initial.waitFor({ state: "hidden" });
  assert.equal(writes.length, 2);
  assert.equal(page.url(), origin + setup);
  assert.equal(await page.getByRole("button", { name: /Test brand/ }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("button", { name: "Paid campaign", exact: true }).getAttribute("aria-pressed"), "true");

  await page.goto(origin + "/legal/privacy/cookies?returnTo=" + encodeURIComponent(setup));
  const returnLink = page.getByRole("link", { name: "Back to onboarding", exact: true });
  await returnLink.waitFor({ state: "visible" });
  assert.equal(await returnLink.getAttribute("href"), setup);
  await returnLink.click();
  await initial.waitFor({ state: "visible" });
  assert.equal(page.url(), origin + setup);
  await page.goto(origin + "/legal/privacy?returnTo=" + encodeURIComponent("https://foreign.test"));
  const fallback = page.getByRole("link", { name: "Back to Nettmark", exact: true });
  await fallback.waitFor({ state: "visible" });
  assert.equal(await fallback.getAttribute("href"), "/");
  await browser.close(); browser = null;
  console.log("Mobile policy reading, acceptance retry and onboarding continuity browser checks passed");
}

main().catch(error => {
  console.error(error);
  writeFileSync("legal-navigation-server.log", serverLog);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  server.kill("SIGTERM");
});
