const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { chromium } = require("playwright");

const origin = "http://127.0.0.1:3100";
const userId = "33333333-3333-4333-8333-333333333333";
const openId = "11111111-1111-4111-8111-111111111111";
const restrictedId = "22222222-2222-4222-8222-222222222222";
const setup = "/onboarding/for-partners";
const dto = { description: "A brand offer with clear details.", logoUrl: null, commission: 20, commissionValue: null, currency: "USD", type: "one-time", requestStatus: null, readyOrganicCount: 0 };
let offers = [...Array.from({ length: 24 }, (_, i) => ({ ...dto, id: "aaaaaaaa-aaaa-4aaa-8aaa-" + String(i).padStart(12, "0"), title: "Brand " + (i + 1), participationMode: "open" })),
  { ...dto, id: restrictedId, title: "Approval brand", participationMode: "approval_required" },
  { ...dto, id: openId, title: "Last brand", participationMode: "open" }];
let startCalls = [], completions = 0, failStart = false, failComplete = false, forceApproval = false;
let destinations = [];
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://policy-fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "onboarding-ui-test-key" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "", browser, diagnosticPage;
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
async function insideViewport(locator, page) {
  const box = await locator.boundingBox();
  const size = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height, "Next action is inside the viewport");
}
async function main() {
  await ready();
  browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  for (const viewport of [{ width: 390, height: 650 }, { width: 320, height: 568 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
    const page = await context.newPage();
    diagnosticPage = page;
    page.setDefaultTimeout(30000);
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.hostname === "policy-fixture.supabase.co") return json({});
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/onboarding/affiliate-offers") return json({ offers, userId, termsAccepted: true });
      if (/^\/api\/affiliate\/offers\/[^/]+\/start$/.test(url.pathname)) {
        startCalls.push({ path: url.pathname, method: request.method() });
        if (failStart) return json({ error: "Access could not be started. Try again." }, 503);
        const status = forceApproval || url.pathname.includes(restrictedId) ? "pending" : "approved";
        return json({ ok: true, participation: { status } });
      }
      if (url.pathname === "/api/profile/onboarding-complete") {
        completions++;
        return failComplete ? json({ error: "test completion failed" }, 503) : json({ ok: true });
      }
      if (url.pathname.startsWith("/affiliate/dashboard/promote/")) {
        destinations.push(url.pathname + "?mode=" + url.searchParams.get("mode") + "&source=" + url.searchParams.get("source"));
        // Stop at the handoff: editor authentication/data is outside this UI test.
        return route.abort();
      }
      if (url.pathname.startsWith("/api/")) return json({}, url.pathname === "/api/chatbase/identify" ? 401 : 200);
      return route.continue();
    });

    startCalls = []; completions = 0; destinations = [];
    await page.goto(origin + setup);
    const card = page.getByRole("button", { name: /Last brand/ });
    await card.click(); // Playwright scrolls to the last card, simulating the reported long-list case.
    const heading = page.getByRole("heading", { name: "How would you like to promote?", exact: true });
    await heading.waitFor();
    assert.equal(await heading.evaluate(node => node === document.activeElement), true, "Selection moves keyboard focus into the next step");
    assert.equal(await page.getByRole("button", { name: /Brand 1 / }).count(), 0, "Grid no longer competes with the next action");
    const action = page.getByRole("button", { name: "Create my promotion", exact: true });
    await insideViewport(action, page);
    assert.equal(await page.getByRole("button", { name: /^Organic post/ }).getAttribute("aria-pressed"), "true");
    assert.equal(startCalls.length, 0, "Choosing a brand must not join the offer");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await insideViewport(action, page);
    const lastContent = page.getByText("Commissions depend on eligible, verified results and the offer’s terms.", { exact: true });
    const contentBox = await lastContent.boundingBox(), footerBox = await page.locator('footer[aria-label="Next step"]').boundingBox();
    assert.ok(contentBox && footerBox && contentBox.y + contentBox.height <= footerBox.y, "Footer does not cover the final content");
    if (viewport.width === 390) await page.screenshot({ path: "affiliate-next-step-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Choose another brand", exact: true }).click();
    await page.getByRole("heading", { name: "Who would you like to promote?", exact: true }).waitFor();
    await page.waitForURL(url => url.pathname === setup && !url.searchParams.has("offerId"));
    assert.equal(new URL(page.url()).searchParams.has("offerId"), false);
    const search = page.getByRole("textbox", { name: "Search offers" });
    await search.fill("Last brand");
    await page.getByRole("button", { name: /Last brand/ }).click();
    await heading.waitFor();
    await page.getByRole("button", { name: "Choose another brand", exact: true }).click();
    assert.equal(await search.inputValue(), "Last brand", "Comparing brands preserves the filter");

    await page.goto(origin + setup + "?offerId=" + openId + "&mode=ad");
    await heading.waitFor();
    assert.equal(await page.getByRole("button", { name: /^Paid campaign/ }).getAttribute("aria-pressed"), "true");
    await insideViewport(action, page);
    await page.reload();
    await heading.waitFor();
    assert.equal(await page.getByRole("button", { name: /^Paid campaign/ }).getAttribute("aria-pressed"), "true");
    failStart = true;
    await action.click();
    await page.getByRole("alert").filter({ hasText: "Access could not be started. Try again." }).waitFor();
    assert.equal(completions, 0);
    assert.equal(await action.isEnabled(), true, "Failed access request can retry");
    failStart = false; failComplete = true;
    await action.click();
    await page.getByText("Could not save your progress. Please try again.", { exact: false }).waitFor();
    assert.equal(destinations.length, 0, "Failed completion must not navigate");
    failComplete = false;

    await page.goto(origin + setup + "?offerId=" + restrictedId);
    const requestAction = page.getByRole("button", { name: "Request access", exact: true });
    await requestAction.waitFor(); await insideViewport(requestAction, page);
    const priorCompletions = completions, priorStarts = startCalls.length;
    await requestAction.click();
    await page.getByText("Request sent to Approval brand", { exact: true }).waitFor();
    assert.equal(startCalls.length, priorStarts + 1);
    assert.equal(completions, priorCompletions, "Pending request must not mark onboarding complete");
    assert.equal(await page.getByRole("button", { name: "Waiting for approval", exact: true }).isEnabled(), false);
    await page.getByRole("button", { name: "Choose another brand", exact: true }).click();
    await page.getByRole("heading", { name: "Who would you like to promote?", exact: true }).waitFor();

    // Server authority can change after offers were loaded; open-looking offers may still need approval.
    forceApproval = true;
    await page.goto(origin + setup + "?offerId=" + openId);
    await action.waitFor(); await action.click();
    await page.getByRole("heading", { name: "Your request is pending", exact: true }).waitFor();
    forceApproval = false;

    await page.goto(origin + setup + "?offerId=" + openId + "&mode=ad");
    await action.waitFor();
    failComplete = false;
    const destination = page.waitForRequest(request => new URL(request.url()).pathname === "/affiliate/dashboard/promote/" + openId);
    await action.click({ noWaitAfter: true });
    const handoff = new URL((await destination).url());
    assert.equal(handoff.pathname, "/affiliate/dashboard/promote/" + openId);
    assert.equal(handoff.searchParams.get("mode"), "ad");
    assert.equal(handoff.searchParams.get("source"), "onboarding");
    assert.ok(startCalls.every(call => call.method === "POST"));

    await context.close();
  }
  await browser.close(); browser = null;
  console.log("Onboarding selection, visible next action, back, intent, approval, retry and handoff browser checks passed");
}
main().catch(async error => {
  console.error(error);
  if (diagnosticPage && !diagnosticPage.isClosed()) {
    console.error("Fixture page URL:", diagnosticPage.url());
    try { console.error("Fixture headings/buttons:", await diagnosticPage.locator("h1,h2,button").allTextContents()); } catch {}
  }
  writeFileSync("affiliate-next-step-server.log", serverLog);
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); server.kill("SIGTERM"); });
