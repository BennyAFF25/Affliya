/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { checkPaidCurrency, checkPaidCurrencyReadiness, loadPaidCurrencyReadiness } from "../utils/currency/paidCurrencyGuard";
import { PendingProposalRow, type PendingProposal } from "../app/affiliate/dashboard/manage-campaigns/PendingProposalRow";
import { PaidCurrencyWarning } from "../app/affiliate/dashboard/promote/components/PaidCurrencyWarning";

async function run() {
  for (const proposal of ["AUD", null]) {
    for (const account of [undefined, null, "", "AUD"]) {
      assert.equal(checkPaidCurrencyReadiness(proposal, "AUD", account).allowed, true);
      assert.equal(checkPaidCurrency(proposal, "AUD", account).allowed, account === "AUD");
    }
    for (const account of ["USD", "GBP", "CAD"]) assert.equal(checkPaidCurrencyReadiness(proposal, "AUD", account).allowed, false);
  }
  for (const currency of ["USD", "GBP", "CAD", "", null]) {
    for (const proposal of [null, currency]) assert.equal(checkPaidCurrencyReadiness(proposal, currency).allowed, false);
  }
  assert.equal(checkPaidCurrencyReadiness("", "AUD").allowed, false);
  assert.equal(checkPaidCurrencyReadiness("USD", "AUD", "AUD").allowed, false);
  assert.equal(checkPaidCurrencyReadiness("AUD", "USD", null).allowed, true, "Proposal snapshot wins");

  for (const count of [1, 30]) {
    let reads = 0;
    const offers = Array.from({ length: count }, (_, i) => ({ id: String(i), business_email: `brand${i}`, currency: "AUD" }));
    const connections = offers.flatMap(offer => [
      { business_email: offer.business_email, page_id: "page", ad_account_id: "account", ad_account_currency: "USD" },
      { business_email: offer.business_email, page_id: "page", ad_account_id: "account", ad_account_currency: "AUD" },
    ]);
    const db = { from(table: string) {
      reads++;
      const q: any = { select: () => q, in: () => q, order: () => q, then: (resolve: any) => Promise.resolve({ data: table === "offers" ? offers : connections }).then(resolve) };
      return q;
    } };
    const check = await loadPaidCurrencyReadiness(db, offers.map(o => o.id));
    for (const offer of offers) assert.equal(check(offer.id, null).allowed, false, "Newest exact connection wins");
    assert.equal(reads, 2, "Currency queries constant across distinct proposals/offers");
    reads = 0;
    await loadPaidCurrencyReadiness(db, offers.map(o => o.id), offers);
    assert.equal(reads, 1, "Reuse pending endpoint offer batch");
    connections.length = 0;
    const disconnected = await loadPaidCurrencyReadiness(db, offers.map(o => o.id), offers);
    assert.equal(disconnected("0", null).allowed, true);
    assert.equal(disconnected("missing", null).allowed, false);
    assert.equal(disconnected("missing", "AUD").allowed, false);
    offers[0] = { ...offers[0], meta_page_id: "selected", meta_ad_account_id: "selected" } as any;
    connections.push({ business_email: offers[0].business_email, page_id: "unrelated", ad_account_id: "unrelated", ad_account_currency: "USD" });
    const unrelated = await loadPaidCurrencyReadiness(db, ["0"], offers);
    assert.equal(unrelated("0", null).allowed, true, "Unrelated account must not block selected account");
  }
  const fixtures = [
    ["04d50f3c", "AUD", "AUD", null, false], ["11d91be9", null, "AUD", null, false],
    ["partner", null, "AUD", "AUD", false],
    ["ec9aa6ae", "GBP", "GBP", null, true], ["84928833", null, "GBP", null, true],
    ["2b8b86c5", null, "CAD", null, true], ["ef4fef7e", null, "USD", null, true],
    ["0237e3ba", "USD", "USD", null, true], ["17c71efb", "USD", "USD", null, true],
    ["97639bf0", "GBP", "GBP", null, true], ["a8dbc13c", null, "USD", "AUD", true],
    ["10b65db8", null, "USD", "AUD", true],
  ] as const;
  for (const [id, proposalCurrency, offerCurrency, accountCurrency, blocked] of fixtures) {
    const result = checkPaidCurrencyReadiness(proposalCurrency, offerCurrency, accountCurrency);
    const proposal = { id, kind: "paid", offerTitle: id, currency: proposalCurrency,
      state: result.allowed ? "waiting_for_business" : "currency_blocked", currencyBlock: result.message,
      growthReady: false, funding: null } as PendingProposal;
    const html = renderToStaticMarkup(React.createElement(PendingProposalRow, { proposal }));
    assert.equal(html.includes("PAID LAUNCH BLOCKED"), blocked, id);
    assert.equal(html.includes("WAITING FOR BUSINESS"), !blocked, id);
  }
  for (const mode of ["ad", "organic"] as const) {
    const html = renderToStaticMarkup(React.createElement(PaidCurrencyWarning, { currency: "GBP", mode }));
    assert.equal(html.includes('role="alert"'), mode === "ad");
  }
  assert.equal(renderToStaticMarkup(React.createElement(PaidCurrencyWarning, { currency: "AUD", mode: "ad" })), "");
  const source = readFileSync("app/affiliate/dashboard/promote/[offerId]/page.tsx", "utf8");
  assert.ok(source.indexOf("setOfferCurrency(String(offer?.currency") < source.indexOf('const { data: requestRow }'));
  assert.ok(source.indexOf("<PaidCurrencyWarning") < source.indexOf("<AIPromotionPackPanel"));
  for (const route of ["affiliate/pending-paid-proposals", "business/ad-ideas/review-readiness"]) {
    const text = readFileSync(`app/api/${route}/route.ts`, "utf8");
    assert.match(text, /currencyReadiness: currencyReadiness\(offerId, (proposal|idea).currency\)/);
  }
  console.log("Segment 1b advisory matrix, constant batch reads, exact account and early/organic warning tests passed");
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
